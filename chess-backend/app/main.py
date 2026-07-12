"""
main.py — Servidor FastAPI para la app de ajedrez.

Endpoints:
  POST /api/move         → El bot calcula y ejecuta su jugada
  POST /api/hint         → Pide una pista sin mover
  POST /api/evaluate     → Evalúa la posición actual en centipawns
  GET  /api/legal-moves  → Movimientos legales para una posición
  POST /api/new-game     → Reinicia a posición inicial
  GET  /api/health       → Verifica que el servidor y Stockfish estén vivos

¿Por qué separar /move de /hint?
/move aplica el movimiento del bot y devuelve el FEN actualizado.
/hint solo sugiere sin modificar nada — el usuario decide si lo sigue.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import chess

from typing import Optional

from app.engine import chess_engine
from app.commentary_service import generar_comentario
from app.analysis_service import analyze_move
from app.chesscom_service import get_archives, get_games
from app.games_db import init_db, save_game, list_games, get_game, delete_game


# ---------------------------------------------------------------------------
# Modelos de request/response
# ¿Por qué Pydantic? Valida automáticamente los datos entrantes y
# genera documentación legible en /docs sin código extra.
# ---------------------------------------------------------------------------

class MoveRequest(BaseModel):
    fen: str = Field(
        description="Posición actual en formato FEN",
        example="rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    )
    skill_level: int = Field(
        default=10,
        ge=0,
        le=20,
        description="Nivel de Stockfish: 0=principiante, 20=maestro",
    )
    time_limit: float = Field(
        default=1.0,
        ge=0.1,
        le=10.0,
        description="Tiempo máximo de cálculo en segundos",
    )


class HintRequest(BaseModel):
    fen: str = Field(description="Posición actual en formato FEN")


class TopMovesRequest(BaseModel):
    fen: str = Field(description="Posición actual en formato FEN")
    count: int = Field(default=3, ge=1, le=5, description="Número de mejores jugadas a devolver")
    time_limit: float = Field(default=1.5, ge=0.5, le=5.0, description="Tiempo de análisis en segundos")


class EvaluateRequest(BaseModel):
    fen: str = Field(description="Posición a evaluar en formato FEN")
    depth: int = Field(
        default=15,
        ge=1,
        le=25,
        description="Profundidad de análisis (más = más preciso pero más lento)",
    )


class CommentaryRequest(BaseModel):
    fen_antes: str   = Field(description="FEN de la posición ANTES de la jugada")
    fen_despues: str = Field(description="FEN de la posición DESPUÉS de la jugada")
    move_san: str    = Field(description="Jugada en notación algebraica, ej: 'Nf3'")
    move_uci: str    = Field(description="Jugada en notación UCI, ej: 'g1f3'")
    color: str       = Field(description="'white' o 'black'")
    es_bot: bool     = Field(description="True si fue jugada del motor")
    skill_level: int = Field(default=10, ge=0, le=20)


class AnalyzeMoveRequest(BaseModel):
    fen_before: str = Field(description="FEN de la posición antes de la jugada")
    move_uci: str = Field(description="Jugada realmente hecha, en UCI ('e2e4')")
    eval_before: Optional[int] = Field(
        default=None,
        description="Eval cacheada de fen_before en cp POV blancas "
                    "(el eval_after del ply anterior). Ahorra una pasada.",
    )
    depth: int = Field(default=14, ge=8, le=22, description="Profundidad Stockfish")


class NewGameResponse(BaseModel):
    fen: str
    message: str


class SaveGameRequest(BaseModel):
    player_color: str = Field(description="'white' o 'black' — color con el que jugó el usuario")
    skill_level: int = Field(ge=0, le=20, description="Nivel de Stockfish del rival")
    result: str = Field(description="'1-0' / '0-1' / '1/2-1/2'")
    moves_san: list[str] = Field(default_factory=list, description="Jugadas en notación SAN, en orden")
    white_accuracy: Optional[float] = Field(default=None, description="Precisión de blancas (0-100), si ya se calculó")
    black_accuracy: Optional[float] = Field(default=None, description="Precisión de negras (0-100), si ya se calculó")
    opponent_label: Optional[str] = Field(default=None, description="Etiqueta del rival, ej. 'Stockfish nivel 10'")


# ---------------------------------------------------------------------------
# Lifespan — arranca y apaga el motor de forma limpia
# ¿Por qué usar lifespan en vez de @app.on_event?
# on_event está deprecado en FastAPI moderno. Lifespan es el patrón correcto
# y garantiza que Stockfish siempre se cierra al apagar el servidor.
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: pre-calentar Stockfish para que el primer request no tarde extra
    try:
        chess_engine._get_engine()
        print("[OK] Stockfish iniciado correctamente")
    except FileNotFoundError as e:
        print(f"[AVISO] {e}")
        print("El servidor arrancará pero los endpoints de juego fallarán.")
    try:
        init_db()
        print("[OK] Base de datos de partidas lista")
    except Exception as e:
        print(f"[AVISO] No se pudo inicializar la base de datos de partidas: {e}")
    yield
    # Shutdown: cerrar el proceso de Stockfish limpiamente
    chess_engine.close()
    print("[STOP] Stockfish cerrado")


# ---------------------------------------------------------------------------
# Aplicación
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Chess AI API",
    description="Backend de ajedrez con motor Stockfish para entrenamiento",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — permite que el frontend React (puerto 5173) llame a este backend
# ¿Por qué allow_origins=["*"] en desarrollo?
# En producción deberías cambiarlo a la URL exacta de tu frontend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health_check():
    """
    Verifica que el servidor esté vivo y Stockfish disponible.
    Útil para el frontend saber si puede conectarse antes de mostrar el tablero.
    """
    try:
        with chess_engine.lock:
            engine = chess_engine._get_engine()
            name = engine.id.get("name", "Stockfish")
        return {
            "status": "ok",
            "stockfish": "connected",
            "engine_name": name,
        }
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Stockfish no disponible: {str(e)}")


@app.post("/api/new-game")
def new_game() -> NewGameResponse:
    """
    Devuelve el FEN de la posición inicial.
    El estado del tablero vive en el frontend (stateless backend).

    ¿Por qué stateless?
    No guardamos el estado de la partida en el servidor — cada request
    lleva el FEN completo. Esto simplifica mucho el backend y permite
    múltiples partidas simultáneas sin sesiones.
    """
    return NewGameResponse(
        fen=chess.STARTING_FEN,
        message="Nueva partida iniciada",
    )


@app.post("/api/move")
def get_bot_move(request: MoveRequest):
    """
    El bot calcula su jugada para la posición dada.

    Flujo:
    1. Frontend hace el movimiento del jugador y actualiza su FEN local
    2. Envía ese FEN aquí
    3. Stockfish calcula la respuesta
    4. Devolvemos el movimiento y el FEN actualizado
    5. El frontend aplica ese movimiento en el tablero visual

    ¿Por qué el frontend no calcula con stockfish.js directamente?
    Stockfish.js en el navegador existe pero consume mucha RAM y
    bloquea el hilo principal. Un backend dedicado es más eficiente
    y permite compartir la instancia entre usuarios.
    """
    try:
        result = chess_engine.get_best_move(
            fen=request.fen,
            skill_level=request.skill_level,
            time_limit=request.time_limit,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"FEN inválido: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error del motor: {str(e)}")


@app.post("/api/hint")
def get_hint(request: HintRequest):
    """
    Devuelve la mejor jugada posible sin ejecutarla.

    El frontend puede usar esto para:
    - Resaltar la pieza que debería moverse (from_square)
    - Resaltar la casilla destino (to_square)
    - Mostrar la jugada en notación UCI
    """
    try:
        result = chess_engine.get_hint(fen=request.fen)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"FEN inválido: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error del motor: {str(e)}")


@app.post("/api/top-moves")
def get_top_moves(request: TopMovesRequest):
    """
    Devuelve las N mejores jugadas para una posición usando MultiPV de Stockfish.

    Usado por el panel de sugerencias del frontend para mostrar al jugador
    las mejores opciones con explicaciones en lenguaje natural.

    Cada jugada incluye:
      - uci / san:    la jugada en formatos UCI y algebraico
      - from_square / to_square: casillas para resaltar en el tablero
      - score:        evaluación en centipawns (null si hay mate anunciado)
      - mate_in:      número de jugadas hasta mate (null si no hay mate)
      - fen_after:    posición resultante para previsualizar
      - piece:        tipo de pieza que mueve (p/n/b/r/q/k)
      - is_capture:   si la jugada captura una pieza rival
      - is_check:     si la jugada da jaque
    """
    try:
        moves = chess_engine.get_top_moves(
            fen=request.fen,
            count=request.count,
            time_limit=request.time_limit,
        )
        return {"moves": moves}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"FEN inválido: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error del motor: {str(e)}")


@app.post("/api/evaluate")
def evaluate_position(request: EvaluateRequest):
    """
    Analiza la posición y devuelve puntuación en centipawns.

    El frontend puede convertir esto en una barra visual de ventaja:
    - score > 0: blancas tienen ventaja
    - score < 0: negras tienen ventaja
    - mate_in != null: hay un jaque mate en N jugadas
    - |score| > 300: ventaja decisiva
    - |score| > 150: ventaja clara
    - |score| < 50: posición equilibrada
    """
    try:
        result = chess_engine.evaluate_position(
            fen=request.fen,
            depth=request.depth,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"FEN inválido: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error del motor: {str(e)}")


@app.post("/api/commentary")
async def get_commentary(request: CommentaryRequest):
    """
    Genera comentario de nivel Gran Maestro para una jugada.

    Combina la evaluación numérica de Stockfish con análisis en lenguaje
    natural de Claude para explicar el propósito táctico y estratégico
    de cada movimiento — tanto del jugador como del rival.

    Responde con:
      - titulo:        Frase corta que resume la jugada
      - razonamiento:  Análisis táctico/posicional profundo (2-3 oraciones)
      - amenaza:       Qué amenaza concreta crea o neutraliza
      - plan:          Plan estratégico a seguir
      - consejo:       Consejo de entrenamiento (solo para jugadas del humano)
      - clasificacion: Excelente / Buena jugada / Imprecisión / Error / etc.
      - eval_antes:    Evaluación Stockfish antes (centipawns)
      - eval_despues:  Evaluación Stockfish después (centipawns)
    """
    try:
        result = await generar_comentario(
            fen_antes=request.fen_antes,
            fen_despues=request.fen_despues,
            move_san=request.move_san,
            move_uci=request.move_uci,
            color_jugada=request.color,
            es_bot=request.es_bot,
            skill_level=request.skill_level,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"FEN inválido: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generando comentario: {str(e)}")


@app.post("/api/analyze-move")
def analyze_single_move(request: AnalyzeMoveRequest):
    """
    Analiza UNA jugada de una partida importada (Game Review estilo chess.com).

    El frontend recorre el PGN ply a ply llamando aquí. Devuelve clasificación
    (Brillante/Mejor/Excelente/Buena/Imprecisión/Error/Error grave), la mejor
    jugada alternativa con su línea, precisión 0-100 y explicación en español.

    Pasar eval_before (el eval_after de la respuesta anterior) reduce el
    trabajo del motor: solo se analizan 2 posiciones en vez de 3.
    """
    try:
        return analyze_move(
            fen_before=request.fen_before,
            move_uci=request.move_uci,
            eval_before_cp=request.eval_before,
            depth=request.depth,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error del motor: {str(e)}")


@app.get("/api/chesscom/{username}/archives")
async def chesscom_archives(username: str):
    """
    Meses con partidas disponibles para un usuario de chess.com.
    Devuelve [{year, month}] ordenado del más reciente al más antiguo.
    """
    try:
        archives = await get_archives(username)
        months = []
        for url in archives:
            parts = url.rstrip("/").split("/")
            months.append({"year": int(parts[-2]), "month": int(parts[-1])})
        months.sort(key=lambda m: (m["year"], m["month"]), reverse=True)
        return {"months": months}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando chess.com: {str(e)}")


@app.get("/api/chesscom/{username}/games/{year}/{month}")
async def chesscom_games(username: str, year: int, month: int):
    """
    Partidas de un mes concreto de un usuario de chess.com, con PGN completo.
    El frontend muestra la lista y el usuario elige cuál analizar.
    """
    try:
        games = await get_games(username, year, month)
        return {"games": games}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error consultando chess.com: {str(e)}")


@app.get("/api/legal-moves")
def get_legal_moves(fen: str):
    """
    Devuelve todos los movimientos legales agrupados por casilla de origen.

    Ejemplo de respuesta:
    {
      "moves_by_square": {
        "e2": ["e3", "e4"],
        "g1": ["f3", "h3"]
      }
    }

    El frontend usa esto para resaltar casillas destino cuando el usuario
    selecciona una pieza.
    """
    try:
        result = chess_engine.get_legal_moves(fen=fen)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"FEN inválido: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")


# ---------------------------------------------------------------------------
# Historial de partidas — persistencia en SQLite (sobrevive a reiniciar Docker).
# ---------------------------------------------------------------------------

@app.post("/api/games")
def create_game(request: SaveGameRequest):
    """
    Guarda una partida terminada (jugador vs. bot) en el historial persistente.

    Se llama automáticamente desde el frontend cuando `gameStatus.gameOver`
    pasa a True fuera del modo análisis libre.
    """
    try:
        game_id = save_game(request.model_dump())
        return {"id": game_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error guardando la partida: {str(e)}")


@app.get("/api/games")
def get_games_history():
    """
    Lista resumida del historial de partidas (más reciente primero).
    No incluye las jugadas completas — para eso usa GET /api/games/{id}.
    """
    try:
        return {"games": list_games()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo el historial: {str(e)}")


@app.get("/api/games/{game_id}")
def get_game_detail(game_id: int):
    """Registro completo de una partida guardada, incluyendo la lista de jugadas SAN."""
    try:
        game = get_game(game_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo la partida: {str(e)}")
    if game is None:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    return game


@app.delete("/api/games/{game_id}")
def remove_game(game_id: int):
    """Borra una partida del historial."""
    try:
        deleted = delete_game(game_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error borrando la partida: {str(e)}")
    if not deleted:
        raise HTTPException(status_code=404, detail="Partida no encontrada")
    return {"deleted": True}
