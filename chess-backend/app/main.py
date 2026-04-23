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

from app.engine import chess_engine


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


class NewGameResponse(BaseModel):
    fen: str
    message: str


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
        print("✅ Stockfish iniciado correctamente")
    except FileNotFoundError as e:
        print(f"⚠️  {e}")
        print("El servidor arrancará pero los endpoints de juego fallarán.")
    yield
    # Shutdown: cerrar el proceso de Stockfish limpiamente
    chess_engine.close()
    print("🔴 Stockfish cerrado")


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
        engine = chess_engine._get_engine()
        return {
            "status": "ok",
            "stockfish": "connected",
            "engine_name": engine.id.get("name", "Stockfish"),
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
