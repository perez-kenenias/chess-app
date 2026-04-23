"""
engine.py — Wrapper de Stockfish usando python-chess.

¿Por qué un wrapper propio en vez de usar stockfish directamente?
- python-chess ya maneja el protocolo UCI de forma robusta
- Aquí centralizamos: nivel, tiempo de pensamiento, análisis y pistas
- Si en el futuro quieres cambiar de motor (Leela, Komodo), solo tocas este archivo
"""

import chess
import chess.engine
import os
from typing import Optional, List


# Ruta al binario de Stockfish.
# Orden de búsqueda:
#   1. Variable de entorno STOCKFISH_PATH (para producción/Docker)
#   2. Rutas comunes en Linux/Mac/Windows
STOCKFISH_PATHS = [
    os.environ.get("STOCKFISH_PATH", ""),
    r"C:\Program Files\Stockfish\stockfish-windows-x86-64-avx2.exe",
    "/usr/games/stockfish",
    "/usr/local/bin/stockfish",
    "/opt/homebrew/bin/stockfish",
    "stockfish",
    "stockfish.exe",
]


def _find_stockfish() -> str:
    for path in STOCKFISH_PATHS:
        if not path:
            continue
        if os.path.isfile(path):
            return path
        if path in ("stockfish", "stockfish.exe"):
            return path
    raise FileNotFoundError(
        "No se encontró Stockfish. Define STOCKFISH_PATH o verifica la ruta."
    )


class ChessEngine:
    """
    Gestiona la instancia de Stockfish.

    ¿Por qué no abrir/cerrar el proceso en cada request?
    Abrir un proceso cuesta ~200ms. Con una instancia persistente
    cada request tarda solo los milisegundos que Stockfish necesita
    para calcular, no el overhead de arranque.
    """

    def __init__(self):
        self._engine: Optional[chess.engine.SimpleEngine] = None

    def _get_engine(self) -> chess.engine.SimpleEngine:
        """Retorna la instancia activa, creándola si no existe."""
        if self._engine is None:
            path = _find_stockfish()
            self._engine = chess.engine.SimpleEngine.popen_uci(path)
        return self._engine

    def close(self):
        """Cierra el proceso de Stockfish correctamente al apagar el servidor."""
        if self._engine:
            self._engine.quit()
            self._engine = None

    def get_best_move(
        self,
        fen: str,
        skill_level: int = 10,
        time_limit: float = 1.0,
    ) -> dict:
        """
        Calcula el mejor movimiento para una posición dada.

        Args:
            fen: Posición del tablero en formato FEN
                 Ejemplo: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
            skill_level: Nivel de juego de Stockfish (0=principiante, 20=maestro)
            time_limit: Tiempo máximo de cálculo en segundos

        Returns:
            dict con la jugada en formato UCI (ej: "e2e4") y la evaluación

        ¿Por qué Skill Level funciona así?
        Con nivel bajo, Stockfish introduce errores deliberados en su búsqueda
        usando un algoritmo llamado "MultiPV con ruido". No solo juega más lento,
        sino que activamente elige jugadas subóptimas para simular humanos reales.
        """
        engine = self._get_engine()
        board = chess.Board(fen)

        # Verificar que la partida no haya terminado
        if board.is_game_over():
            return {
                "move": None,
                "game_over": True,
                "result": board.result(),
            }

        # Configurar nivel de habilidad ANTES de calcular
        # Skill Level 0-20 mapea a ~500-3600 Elo aproximadamente
        engine.configure({"Skill Level": max(0, min(20, skill_level))})

        # Calcular mejor jugada
        result = engine.play(
            board,
            chess.engine.Limit(time=time_limit),
        )

        move = result.move
        board.push(move)  # Aplicar el movimiento para obtener el FEN actualizado

        return {
            "move": move.uci(),          # Ej: "e2e4", "g1f3"
            "move_san": result.move.uci(), # TODO: convertir a SAN si se necesita
            "fen_after": board.fen(),      # FEN después del movimiento del bot
            "game_over": board.is_game_over(),
            "result": board.result() if board.is_game_over() else None,
            "in_check": board.is_check(),
        }

    def get_hint(
        self,
        fen: str,
        skill_level: int = 20,  # Las pistas siempre usan el máximo nivel
        time_limit: float = 2.0,
    ) -> dict:
        """
        Devuelve una pista (el mejor movimiento disponible) sin ejecutarlo.

        ¿Por qué las pistas usan nivel 20 aunque el juego sea en nivel bajo?
        Una pista debe ser siempre el movimiento óptimo — si le pides ayuda
        al coach, quieres la mejor jugada, no una aleatoria.
        """
        engine = self._get_engine()
        board = chess.Board(fen)

        if board.is_game_over():
            return {"hint": None, "game_over": True}

        engine.configure({"Skill Level": 20})  # Nivel máximo para pistas

        result = engine.play(
            board,
            chess.engine.Limit(time=time_limit),
        )

        return {
            "hint": result.move.uci(),
            "from_square": chess.square_name(result.move.from_square),
            "to_square": chess.square_name(result.move.to_square),
        }

    def evaluate_position(
        self,
        fen: str,
        depth: int = 15,
    ) -> dict:
        """
        Analiza una posición y devuelve una puntuación numérica.

        ¿Qué son los centipawns?
        La evaluación se mide en "centipawns" (centésimas de peón).
        +100 = ventaja de 1 peón para blancas
        -300 = ventaja de 3 piezas para negras
        +9999 = jaque mate inminente para blancas

        Args:
            depth: Profundidad de análisis en plies (jugadas parciales).
                   Más profundidad = más preciso pero más lento.
                   Depth 15 tarda ~0.5s, depth 20 tarda ~2-5s.
        """
        engine = self._get_engine()
        board = chess.Board(fen)

        if board.is_game_over():
            return {
                "score": None,
                "mate_in": None,
                "game_over": True,
                "result": board.result(),
            }

        engine.configure({"Skill Level": 20})  # Siempre máximo para análisis

        info = engine.analyse(
            board,
            chess.engine.Limit(depth=depth),
        )

        score = info["score"].relative  # Relativo al jugador en turno

        # Extraer centipawns o mate
        if score.is_mate():
            return {
                "score": None,
                "mate_in": score.mate(),   # Positivo = mate para el jugador en turno
                "centipawns": None,
                "game_over": False,
            }

        return {
            "score": score.score(),        # Centipawns (-9999 a +9999)
            "mate_in": None,
            "centipawns": score.score(),
            "game_over": False,
            "depth_reached": info.get("depth", depth),
        }

    def get_top_moves(
        self,
        fen: str,
        count: int = 3,
        time_limit: float = 1.5,
    ) -> List[dict]:
        """
        Devuelve las N mejores jugadas usando la función MultiPV de Stockfish.

        MultiPV (Multiple Principal Variations) le ordena a Stockfish que
        calcule simultáneamente las N mejores líneas en lugar de solo la mejor.
        Es más lento, pero permite mostrar varias opciones al jugador.

        Args:
            fen:        Posición actual en formato FEN
            count:      Número de jugadas a devolver (normalmente 3)
            time_limit: Tiempo máximo de cálculo en segundos

        Returns:
            Lista de dicts, una por jugada, ordenadas de mejor a peor:
            {
                "uci":         "e2e4",        # formato UCI
                "san":         "e4",          # notación algebraica legible
                "from_square": "e2",
                "to_square":   "e4",
                "score":       35,            # centipawns (null si hay mate)
                "mate_in":     null,          # número de jugadas hasta mate
                "fen_after":   "rnbq...",     # FEN después de esta jugada
                "piece":       "p",           # tipo de pieza: p/n/b/r/q/k
                "is_capture":  false,
                "is_check":    false,
            }
        """
        engine = self._get_engine()
        board  = chess.Board(fen)

        if board.is_game_over():
            return []

        # Limitar count a los movimientos legales disponibles
        legal_count = min(count, len(list(board.legal_moves)))
        if legal_count == 0:
            return []

        # Activar MultiPV para obtener varias líneas
        engine.configure({"MultiPV": legal_count, "Skill Level": 20})

        try:
            info_list = engine.analyse(
                board,
                chess.engine.Limit(time=time_limit),
                multipv=legal_count,
            )
        finally:
            # Restaurar a 1 para que las demás operaciones no se vean afectadas
            engine.configure({"MultiPV": 1})

        results = []
        for info in info_list:
            if not info.get("pv"):
                continue

            move      = info["pv"][0]
            score_obj = info["score"].relative

            # Detectar propiedades del movimiento
            is_capture = board.is_capture(move)
            piece_type  = board.piece_at(move.from_square)
            piece_char  = piece_type.symbol().lower() if piece_type else "p"

            # Calcular posición después del movimiento
            board_copy = board.copy()
            san        = board_copy.san(move)  # notación algebraica antes de aplicar
            board_copy.push(move)
            is_check = board_copy.is_check()

            # Extraer puntuación
            if score_obj.is_mate():
                score_val = None
                mate_in   = score_obj.mate()
            else:
                score_val = score_obj.score()
                mate_in   = None

            results.append({
                "uci":         move.uci(),
                "san":         san,
                "from_square": chess.square_name(move.from_square),
                "to_square":   chess.square_name(move.to_square),
                "score":       score_val,
                "mate_in":     mate_in,
                "fen_after":   board_copy.fen(),
                "piece":       piece_char,
                "is_capture":  is_capture,
                "is_check":    is_check,
            })

        return results

    def get_legal_moves(self, fen: str) -> dict:
        """
        Devuelve todos los movimientos legales para una posición.

        ¿Para qué sirve esto?
        El frontend puede resaltar las casillas a las que una pieza puede moverse
        cuando el usuario la selecciona, sin necesidad de calcular en el cliente.
        chess.js en el frontend también puede hacerlo, pero tener este endpoint
        permite validaciones server-side más seguras.
        """
        board = chess.Board(fen)

        moves_by_square: dict[str, list[str]] = {}
        for move in board.legal_moves:
            from_sq = chess.square_name(move.from_square)
            to_sq = chess.square_name(move.to_square)
            if from_sq not in moves_by_square:
                moves_by_square[from_sq] = []
            moves_by_square[from_sq].append(to_sq)

        return {
            "legal_moves": [m.uci() for m in board.legal_moves],
            "moves_by_square": moves_by_square,
            "turn": "white" if board.turn == chess.WHITE else "black",
        }


# Instancia global — un solo proceso de Stockfish para todo el servidor
# ¿Por qué global? Para no abrir/cerrar el proceso en cada request HTTP
chess_engine = ChessEngine()
