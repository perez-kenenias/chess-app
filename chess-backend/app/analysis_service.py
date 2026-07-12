"""
analysis_service.py — Análisis jugada a jugada estilo chess.com Game Review.

Flujo:
  El frontend parsea el PGN con chess.js y llama a /api/analyze-move una vez
  por cada media jugada (ply). El backend evalúa la posición con Stockfish,
  compara la jugada hecha contra la mejor disponible y devuelve:

    - clasificación (Brillante / Mejor / Excelente / Buena / Imprecisión /
      Error / Error grave / Forzada)
    - evaluación antes/después (siempre desde el punto de vista de blancas)
    - la mejor jugada que había y su línea principal
    - precisión de la jugada (0-100, fórmula tipo chess.com basada en win%)
    - explicación heurística en español de qué pasó

¿Por qué una llamada por jugada en vez de analizar todo el PGN de golpe?
Una partida de 40 jugadas tarda ~30-60 s en analizarse. Con una llamada por
ply el frontend puede mostrar una barra de progreso real y cancelar a mitad.
Además el eval_after de la jugada N es el eval_before de la N+1, así que el
frontend lo cachea y cada request solo cuesta UNA pasada de Stockfish.
"""

import math
from typing import Optional

import chess

from app.engine import chess_engine

# Valores de material clásicos para detectar sacrificios y piezas colgadas
PIECE_VALUES = {
    chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3,
    chess.ROOK: 5, chess.QUEEN: 9, chess.KING: 0,
}

# Nombres de piezas en español para las explicaciones
PIECE_NAMES_ES = {
    chess.PAWN: "el peón", chess.KNIGHT: "el caballo", chess.BISHOP: "el alfil",
    chess.ROOK: "la torre", chess.QUEEN: "la dama", chess.KING: "el rey",
}

# Puntuación equivalente cuando hay mate anunciado (para calcular cp_loss)
MATE_SCORE = 10000


def _score_to_cp_white(score_obj: chess.engine.PovScore) -> int:
    """Convierte un PovScore a centipawns desde el punto de vista de BLANCAS.

    Los mates se convierten a ±(MATE_SCORE - jugadas_hasta_mate) para que
    un mate en 2 valga más que un mate en 8 al comparar jugadas.
    """
    white_score = score_obj.white()
    if white_score.is_mate():
        mate = white_score.mate()
        if mate > 0:
            return MATE_SCORE - mate
        return -MATE_SCORE - mate
    return white_score.score()


def _win_percent(cp_white: int, pov_white: bool) -> float:
    """Convierte centipawns a probabilidad de victoria 0-100 (fórmula lichess).

    Se usa para la precisión: perder 100 cp en posición igualada duele mucho
    más que perder 100 cp cuando ya vas +900, y el win% captura eso.
    """
    cp = cp_white if pov_white else -cp_white
    cp = max(-1500, min(1500, cp))
    return 50 + 50 * (2 / (1 + math.exp(-0.00368208 * cp)) - 1)


def _move_accuracy(win_before: float, win_after: float) -> float:
    """Precisión 0-100 de una jugada según la caída de win% (fórmula lichess)."""
    if win_after >= win_before:
        return 100.0
    delta = win_before - win_after
    raw = 103.1668 * math.exp(-0.04354 * delta) - 3.1669
    return max(0.0, min(100.0, raw))


def _classify(cp_loss: int, is_best: bool, is_forced: bool,
              is_brilliant: bool, missed_mate: bool,
              allowed_mate: bool) -> dict:
    """Clasifica la jugada con los umbrales de cp_loss estilo chess.com."""
    if is_forced:
        return {"key": "forced", "label": "Forzada", "icon": "⚙"}
    if is_brilliant:
        return {"key": "brilliant", "label": "¡¡Brillante!!", "icon": "!!"}
    if is_best:
        return {"key": "best", "label": "La mejor", "icon": "★"}
    if allowed_mate:
        return {"key": "blunder", "label": "Error grave", "icon": "??"}
    if missed_mate and cp_loss > 100:
        return {"key": "miss", "label": "Mate perdido", "icon": "✗"}
    if cp_loss <= 20:
        return {"key": "excellent", "label": "Excelente", "icon": "✦"}
    if cp_loss <= 50:
        return {"key": "good", "label": "Buena", "icon": "✓"}
    if cp_loss <= 100:
        return {"key": "inaccuracy", "label": "Imprecisión", "icon": "?!"}
    if cp_loss <= 250:
        return {"key": "mistake", "label": "Error", "icon": "?"}
    return {"key": "blunder", "label": "Error grave", "icon": "??"}


def _hanging_piece_after(board_after: chess.Board, move: chess.Move) -> Optional[str]:
    """Detecta si la pieza que acaba de mover quedó colgada (atacada y mal defendida)."""
    sq = move.to_square
    piece = board_after.piece_at(sq)
    if piece is None:
        return None
    enemy = board_after.turn  # después del push, es turno del rival
    attackers = board_after.attackers(enemy, sq)
    if not attackers:
        return None
    defenders = board_after.attackers(not enemy, sq)
    min_attacker = min(
        (PIECE_VALUES[board_after.piece_at(a).piece_type] for a in attackers),
        default=99,
    )
    val = PIECE_VALUES[piece.piece_type]
    # Colgada si la puede tomar algo más barato, o si nadie la defiende
    if min_attacker < val or (not defenders and val > 0):
        return PIECE_NAMES_ES[piece.piece_type]
    return None


def _describe_move(board_before: chess.Board, move: chess.Move) -> list[str]:
    """Rasgos tácticos de la jugada, en frases cortas en español."""
    feats = []
    piece = board_before.piece_at(move.from_square)
    if board_before.is_castling(move):
        feats.append("enroca y pone al rey a salvo")
    elif board_before.is_capture(move):
        captured = board_before.piece_at(move.to_square)
        if captured:
            feats.append(f"captura {PIECE_NAMES_ES[captured.piece_type]}")
        else:
            feats.append("captura al paso")
    if move.promotion:
        feats.append("corona una nueva dama" if move.promotion == chess.QUEEN
                      else "promociona el peón")
    board_tmp = board_before.copy()
    board_tmp.push(move)
    if board_tmp.is_checkmate():
        feats.append("¡jaque mate!")
    elif board_tmp.is_check():
        feats.append("da jaque")
    if piece and piece.piece_type in (chess.KNIGHT, chess.BISHOP) and \
            chess.square_rank(move.from_square) in (0, 7):
        feats.append("desarrolla una pieza")
    return feats


def _explain(clasificacion: dict, cp_loss: int, san: str, best_san: str,
             best_line_san: list[str], color: str,
             hanging: Optional[str], feats: list[str],
             missed_mate_in: Optional[int],
             allowed_mate_in: Optional[int]) -> str:
    """Genera la explicación en español, estilo revisión de chess.com."""
    quien = "Blancas" if color == "white" else "Negras"
    partes = []

    key = clasificacion["key"]
    if key == "forced":
        return f"{san} era prácticamente la única jugada razonable en esta posición."
    if key == "brilliant":
        partes.append(f"¡{san} es una jugada brillante! Un sacrificio que Stockfish confirma como la mejor opción.")
    elif key == "best":
        partes.append(f"{san} es exactamente lo que Stockfish habría jugado.")
        if feats:
            partes.append(f"La jugada {', '.join(feats)}.")
        return " ".join(partes)
    elif key == "excellent":
        partes.append(f"{san} es una jugada excelente, casi tan fuerte como {best_san}.")
    elif key == "good":
        partes.append(f"{san} es una buena jugada, aunque {best_san} era algo más precisa.")
    elif key == "inaccuracy":
        partes.append(f"{san} es una imprecisión: pierde parte de la ventaja "
                      f"(≈{cp_loss / 100:.1f} peones). Lo mejor era {best_san}.")
    elif key == "mistake":
        partes.append(f"{san} es un error que cuesta ≈{cp_loss / 100:.1f} peones. "
                      f"La jugada correcta era {best_san}.")
    elif key == "miss":
        partes.append(f"¡{quien} tenían mate en {missed_mate_in} y lo dejaron escapar! "
                      f"La vía ganadora empezaba con {best_san}.")
    elif key == "blunder":
        if allowed_mate_in:
            partes.append(f"{san} es un error grave: permite al rival un mate forzado "
                          f"en {allowed_mate_in}. Había que jugar {best_san}.")
        else:
            partes.append(f"{san} es un error grave que regala ≈{cp_loss / 100:.1f} peones. "
                          f"Stockfish exigía {best_san}.")

    if hanging:
        partes.append(f"Además, {hanging} queda colgado y puede ser capturado.")

    if feats and key not in ("best", "brilliant"):
        partes.append(f"Tu jugada {', '.join(feats)}, pero no era suficiente.")

    if best_line_san and key in ("inaccuracy", "mistake", "blunder", "miss"):
        linea = " ".join(best_line_san[:5])
        partes.append(f"La línea recomendada era: {linea}.")

    return " ".join(partes)


def analyze_move(fen_before: str, move_uci: str,
                 eval_before_cp: Optional[int] = None,
                 depth: int = 14) -> dict:
    """Analiza UNA media jugada. Núcleo del Game Review.

    Args:
        fen_before:     posición antes de la jugada
        move_uci:       la jugada realmente jugada, en UCI ("e2e4")
        eval_before_cp: eval de fen_before en cp (POV blancas) si el frontend
                        la cacheó de la request anterior; ahorra una pasada
        depth:          profundidad Stockfish (14 ≈ 0.3-0.8 s por posición)
    """
    board = chess.Board(fen_before)
    move = chess.Move.from_uci(move_uci)
    if move not in board.legal_moves:
        raise ValueError(f"Jugada ilegal {move_uci} en la posición dada")

    color = "white" if board.turn == chess.WHITE else "black"
    pov_white = board.turn == chess.WHITE
    san = board.san(move)
    legal_count = board.legal_moves.count()

    # Lock: analyze_move manda VARIOS comandos UCI seguidos (analyse antes +
    # analyse después) al mismo proceso de Stockfish que usan también /move,
    # /hint, /top-moves y /evaluate. Sin este lock, un request de Game Review
    # concurrente con cualquiera de esos otros endpoints corrompe el protocolo
    # UCI y lanza errores tipo "CommandState.NEW" (ver engine.py).
    with chess_engine.lock:
        engine = chess_engine._get_engine()
        engine.configure({"Skill Level": 20})

        # ── 1. Analizar la posición ANTES: mejor jugada + línea principal ──────
        info_before = engine.analyse(board, chess.engine.Limit(depth=depth), multipv=1)
        best_info = info_before[0] if isinstance(info_before, list) else info_before
        best_move = best_info["pv"][0]
        best_san = board.san(best_move)
        eval_best = _score_to_cp_white(best_info["score"])
        mate_before = best_info["score"].white().mate()

        # Línea principal en SAN (máx 6 medias jugadas) para mostrar la continuación
        best_line_san = []
        tmp = board.copy()
        for m in best_info["pv"][:6]:
            best_line_san.append(tmp.san(m))
            tmp.push(m)

        # Si el frontend no cacheó eval_before, usamos la del mejor movimiento
        # (es la evaluación "real" de la posición: asumiendo juego perfecto)
        if eval_before_cp is None:
            eval_before_cp = eval_best

        # ── 2. Analizar la posición DESPUÉS de la jugada realmente hecha ───────
        board_after = board.copy()
        board_after.push(move)

        game_over_after = board_after.is_game_over()
        if game_over_after:
            result = board_after.result()
            if board_after.is_checkmate():
                eval_after_cp = MATE_SCORE if color == "white" else -MATE_SCORE
            else:
                eval_after_cp = 0  # tablas
            mate_after = None
        else:
            info_after = engine.analyse(board_after, chess.engine.Limit(depth=depth))
            eval_after_cp = _score_to_cp_white(info_after["score"])
            mate_after = info_after["score"].white().mate()

    # ── 3. Pérdida en centipawns desde el punto de vista del que movió ─────────
    if pov_white:
        cp_loss = max(0, eval_best - eval_after_cp)
    else:
        cp_loss = max(0, eval_after_cp - eval_best)

    is_best = (move == best_move) or cp_loss <= 5
    is_forced = legal_count == 1

    # ¿Tenía mate y lo perdió? / ¿Su jugada permite mate del rival?
    missed_mate_in = None
    allowed_mate_in = None
    if mate_before is not None:
        mate_for_mover = mate_before if pov_white else -mate_before
        if mate_for_mover > 0 and not board_after.is_checkmate():
            if mate_after is None or (mate_after if pov_white else -mate_after) <= 0:
                missed_mate_in = abs(mate_before)
    if mate_after is not None:
        mate_for_rival = -mate_after if pov_white else mate_after
        if mate_for_rival > 0 and (mate_before is None or
                                   (mate_before if pov_white else -mate_before) <= 0):
            allowed_mate_in = abs(mate_after)

    # ¿Brillante? Heurística simple: es la mejor jugada Y sacrifica material
    # (la pieza movida vale ≥3 y queda atacada por algo más barato, o entrega
    # material en la captura) Y la posición sigue siendo buena para el que mueve.
    is_brilliant = False
    if is_best and not is_forced:
        piece = board.piece_at(move.from_square)
        if piece and PIECE_VALUES[piece.piece_type] >= 3:
            attackers = board_after.attackers(board_after.turn, move.to_square)
            defenders = board_after.attackers(not board_after.turn, move.to_square)
            captured_val = 0
            if board.is_capture(move) and board.piece_at(move.to_square):
                captured_val = PIECE_VALUES[board.piece_at(move.to_square).piece_type]
            sacrifices = bool(attackers) and \
                PIECE_VALUES[piece.piece_type] - captured_val >= 2 and \
                len(defenders) < len(attackers)
            mover_eval = eval_after_cp if pov_white else -eval_after_cp
            is_brilliant = sacrifices and mover_eval > -50

    clasificacion = _classify(cp_loss, is_best, is_forced, is_brilliant,
                              missed_mate_in is not None,
                              allowed_mate_in is not None)

    # ── 4. Precisión y explicación ──────────────────────────────────────────────
    win_before = _win_percent(eval_before_cp, pov_white)
    win_after = _win_percent(eval_after_cp, pov_white)
    accuracy = _move_accuracy(win_before, win_after)

    hanging = None if game_over_after else _hanging_piece_after(board_after, move)
    feats = _describe_move(board, move)
    explicacion = _explain(clasificacion, cp_loss, san, best_san, best_line_san,
                           color, hanging, feats, missed_mate_in, allowed_mate_in)

    return {
        "san": san,
        "uci": move_uci,
        "color": color,
        "fen_before": fen_before,
        "fen_after": board_after.fen(),
        "eval_before": eval_before_cp,   # cp, POV blancas
        "eval_after": eval_after_cp,     # cp, POV blancas — cachear para el sig. ply
        "mate_after": mate_after,
        "cp_loss": cp_loss,
        "accuracy": round(accuracy, 1),
        "classification": clasificacion,
        "best_move_san": best_san,
        "best_move_uci": best_move.uci(),
        "best_line_san": best_line_san,
        "explicacion": explicacion,
        "game_over": game_over_after,
    }
