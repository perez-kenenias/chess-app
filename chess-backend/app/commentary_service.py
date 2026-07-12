"""
commentary_service.py — Comentario de Gran Maestro para cada jugada.

Usa Claude para generar análisis de nivel GM después de cada movimiento,
explicando el propósito táctico, la amenaza creada y el plan estratégico.

¿Por qué Claude y no solo Stockfish?
Stockfish da números (centipawns), pero no explica el PORQUÉ en lenguaje
humano. Claude convierte la evaluación numérica en razonamiento real de GM:
"El caballo a f5 crea una horquilla sobre el rey y la torre, forzando la
captura del caballo y cediendo la pareja de alfiles."
"""

import os
import re
import json
import chess
import anthropic
from dotenv import load_dotenv
from pathlib import Path

from app.engine import chess_engine

# Buscar el .env de forma explícita — funciona sin importar desde dónde se ejecuta
_env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)

_api_key = os.getenv("ANTHROPIC_API_KEY")
if not _api_key:
    print("[AVISO] ANTHROPIC_API_KEY no encontrada. El comentario GM no funcionará.")
    print(f"   Busqué .env en: {_env_path.resolve()}")
else:
    print(f"[OK] ANTHROPIC_API_KEY cargada correctamente ({_api_key[:12]}...)")

_client = anthropic.AsyncAnthropic(api_key=_api_key)


# ── Clasificación del movimiento por delta de evaluación ─────────────────────

def _clasificar(eval_antes: int | None, eval_despues: int | None, mate_perdido: bool) -> dict:
    """
    Clasifica la calidad del movimiento según cuánto cambió la evaluación.

    La evaluación siempre se expresa desde el punto de vista del jugador
    que movió (relativa). Un delta positivo = mejoró su posición.

    Retorna: { "texto": str, "color": str, "emoji": str }
    """
    if mate_perdido:
        return {"texto": "Mate perdido", "color": "#f87171", "emoji": "💀"}
    if eval_antes is None or eval_despues is None:
        return {"texto": "Jugada especial", "color": "#a78bfa", "emoji": "♟"}

    delta = eval_despues - eval_antes  # positivo = mejoró para quien mueve

    if delta >= 80:
        return {"texto": "Excelente",    "color": "#4ade80", "emoji": "✨"}
    if delta >= 0:
        return {"texto": "Buena jugada", "color": "#86efac", "emoji": "✓"}
    if delta >= -40:
        return {"texto": "Sólida",       "color": "#fde68a", "emoji": "◎"}
    if delta >= -120:
        return {"texto": "Imprecisión",  "color": "#fbbf24", "emoji": "?!"}
    if delta >= -300:
        return {"texto": "Error",        "color": "#fb923c", "emoji": "?"}
    return             {"texto": "Error grave",  "color": "#f87171", "emoji": "??"}


def _parse_json_safe(text: str) -> dict:
    """Limpia la respuesta de Claude y parsea el JSON aunque venga en bloques markdown."""
    text = text.strip()
    match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if match:
        text = match.group(1).strip()
    return json.loads(text)


# ── Función principal ─────────────────────────────────────────────────────────

async def generar_comentario(
    fen_antes: str,
    fen_despues: str,
    move_san: str,
    move_uci: str,
    color_jugada: str,   # "white" o "black"
    es_bot: bool,
    skill_level: int = 10,
) -> dict:
    """
    Genera comentario de GM para un movimiento dado.

    Flujo:
      1. Evalúa la posición ANTES con Stockfish (desde la perspectiva del que mueve)
      2. Evalúa la posición DESPUÉS con Stockfish
      3. Calcula el delta para clasificar la calidad del movimiento
      4. Pide a Claude una explicación táctica y estratégica de nivel GM
      5. Devuelve todo empaquetado

    Args:
        fen_antes:    FEN antes de la jugada
        fen_despues:  FEN después de la jugada
        move_san:     Notación algebraica ej: "Nf3", "O-O", "exd5"
        move_uci:     Notación UCI ej: "g1f3", "e1g1", "e5d6"
        color_jugada: "white" o "black"
        es_bot:       True si fue jugada del motor
        skill_level:  Nivel del bot (0-20) para contextualizar
    """

    # ── 1. Evaluar con Stockfish ──────────────────────────────────────────────
    eval_antes  = None
    eval_despues = None
    mate_perdido = False

    try:
        r_antes = chess_engine.evaluate_position(fen=fen_antes, depth=14)
        if not r_antes.get("game_over"):
            eval_antes = r_antes.get("centipawns")
            # Si había mate disponible y no se aprovechó, es "Mate perdido"
            if r_antes.get("mate_in") and r_antes["mate_in"] > 0:
                r_desp = chess_engine.evaluate_position(fen=fen_despues, depth=14)
                if not r_desp.get("mate_in"):
                    mate_perdido = True

        r_desp = chess_engine.evaluate_position(fen=fen_despues, depth=14)
        if not r_desp.get("game_over"):
            # Invertir el signo: la evaluación "después" es relativa al RIVAL
            # (es su turno ahora), así que la negamos para tener la perspectiva
            # del jugador que hizo la jugada.
            raw = r_desp.get("centipawns")
            eval_despues = -raw if raw is not None else None
    except Exception:
        pass  # Si Stockfish falla, seguimos sin eval numérica

    # ── 2. Clasificar la jugada ───────────────────────────────────────────────
    clasificacion = _clasificar(eval_antes, eval_despues, mate_perdido)

    # ── 3. Construir contexto de posición para Claude ─────────────────────────
    contexto_fen = ""
    try:
        board = chess.Board(fen_antes)
        fullmove = board.fullmove_number
        phase = (
            "apertura (jugadas 1-10)" if fullmove <= 10
            else "medio juego (jugadas 11-30)" if fullmove <= 30
            else "final de partida"
        )
        material = {
            "blancas": {"peones": 0, "caballos": 0, "alfiles": 0, "torres": 0, "damas": 0},
            "negras":  {"peones": 0, "caballos": 0, "alfiles": 0, "torres": 0, "damas": 0},
        }
        piece_map = {"p": "peones", "n": "caballos", "b": "alfiles", "r": "torres", "q": "damas"}
        for sq in chess.SQUARES:
            p = board.piece_at(sq)
            if p and p.piece_type != chess.KING:
                side = "blancas" if p.color == chess.WHITE else "negras"
                key  = piece_map.get(p.symbol().lower(), "peones")
                material[side][key] += 1

        in_check  = board.is_check()
        contexto_fen = (
            f"Fase: {phase}, jugada {fullmove}. "
            f"Material blancas: {material['blancas']}. "
            f"Material negras: {material['negras']}. "
            + ("¡El rey estaba en jaque antes de esta jugada! " if in_check else "")
        )
    except Exception:
        pass

    # ── 4. Pedir comentario a Claude ──────────────────────────────────────────
    quien = (
        f"el motor Stockfish (nivel {skill_level}/20, "
        f"{'principiante' if skill_level<=4 else 'intermedio' if skill_level<=12 else 'maestro'})"
        if es_bot else "el jugador humano"
    )
    eval_texto = (
        f"Evaluación Stockfish: antes={eval_antes}cp, después={eval_despues}cp "
        f"(delta={((eval_despues or 0)-(eval_antes or 0)):+d}cp). "
        if eval_antes is not None and eval_despues is not None
        else "Evaluación no disponible. "
    )

    prompt = f"""Eres un Gran Maestro de ajedrez comentando en vivo para un estudiante. Analiza esta jugada con profundidad real — no genérica.

POSICIÓN ANTES (FEN): {fen_antes}
POSICIÓN DESPUÉS (FEN): {fen_despues}
JUGADA: {color_jugada.upper()} jugó {move_san} (UCI: {move_uci})
QUIÉN JUGÓ: {quien}
CONTEXTO: {contexto_fen}
{eval_texto}
CLASIFICACIÓN AUTOMÁTICA: {clasificacion['texto']}

Responde SOLO en JSON sin texto adicional:
{{
  "titulo": "Frase de 4-6 palabras que capture la esencia de esta jugada específica (no genérica)",
  "razonamiento": "2-3 oraciones de análisis real de GM. Menciona casillas concretas, piezas específicas, motivos tácticos (horquilla, clavada, descubierta, etc.) o principios posicionales (control del centro, estructura de peones, actividad de piezas). Explica POR QUÉ exactamente este movimiento y no otro.",
  "amenaza": "1 oración concreta: qué amenaza directa crea esta jugada, o si es defensiva, qué ataque específico neutraliza. Menciona casillas.",
  "plan": "1-2 oraciones sobre el plan estratégico a seguir para ESTE bando en los próximos 2-3 movimientos.",
  "consejo": {{"texto": "1 oración de consejo de entrenamiento específico para el humano basado en esta jugada", "tipo": "aprende" o "mejora" o "bien_hecho"}} si es jugada del humano, o null si es del bot
}}"""

    try:
        message = await _client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=800,
            messages=[{"role": "user", "content": prompt}],
        )
        data = _parse_json_safe(message.content[0].text)
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] Error al llamar a Claude API: {type(e).__name__}: {error_msg}")
        # Re-lanzar para que el endpoint lo reporte como error al frontend
        raise RuntimeError(f"Claude API error: {type(e).__name__}: {error_msg}")

    return {
        "move_san":       move_san,
        "move_uci":       move_uci,
        "color":          color_jugada,
        "es_bot":         es_bot,
        "clasificacion":  clasificacion,
        "eval_antes":     eval_antes,
        "eval_despues":   eval_despues,
        **data,
    }
