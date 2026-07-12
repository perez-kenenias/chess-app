"""
games_db.py — Persistencia de partidas jugadas contra el bot (SQLite).

¿Por qué SQLite y no Postgres/Mongo?
Un solo usuario local, sin necesidad de un servidor de base de datos aparte.
sqlite3 viene en la librería estándar de Python — cero dependencias nuevas.

¿Por qué la ruta es configurable con DB_PATH?
En Docker el archivo debe vivir en /app/data (montado como volumen nombrado
en docker-compose.yml) para sobrevivir a `docker compose down` / `up`.
Fuera de Docker cae a ./data/games.db relativo al cwd del proceso.

Esquema (tabla `games`):
  id              INTEGER PRIMARY KEY AUTOINCREMENT
  created_at      TEXT     — ISO8601, UTC
  player_color    TEXT     — 'white' | 'black'
  skill_level     INTEGER  — nivel de Stockfish (0-20)
  result          TEXT     — '1-0' | '0-1' | '1/2-1/2'
  moves_san       TEXT     — jugadas SAN separadas por espacio (reconstruible con chess.js)
  ply_count       INTEGER  — número de medias-jugadas
  white_accuracy  REAL     — nullable, se puede rellenar tras un Game Review
  black_accuracy  REAL     — nullable
  opponent_label  TEXT     — ej. "Stockfish nivel 10"
"""

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional


def _resolve_db_path() -> str:
    path = os.environ.get("DB_PATH", "/app/data/games.db")
    # Si estamos fuera de Docker, /app/data probablemente no exista ni sea
    # escribible: usar una carpeta local relativa al proceso en su lugar.
    if not os.path.isdir("/app"):
        path = os.environ.get("DB_PATH_LOCAL", "./data/games.db")
    return path


DB_PATH = _resolve_db_path()


@contextmanager
def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Crea el directorio y la tabla `games` si no existen. Llamar al arrancar el servidor."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with _get_conn() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS games (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at     TEXT NOT NULL,
                player_color   TEXT NOT NULL,
                skill_level    INTEGER NOT NULL,
                result         TEXT NOT NULL,
                moves_san      TEXT NOT NULL,
                ply_count      INTEGER NOT NULL,
                white_accuracy REAL,
                black_accuracy REAL,
                opponent_label TEXT
            )
            """
        )


def save_game(data: dict) -> int:
    """
    Guarda una partida terminada y devuelve el id insertado.

    `data` esperado:
      player_color: str, skill_level: int, result: str,
      moves_san: list[str], white_accuracy?: float, black_accuracy?: float,
      opponent_label?: str
    """
    moves_san = data.get("moves_san", [])
    moves_str = " ".join(moves_san)
    skill_level = data.get("skill_level", 10)
    opponent_label = data.get("opponent_label") or f"Stockfish nivel {skill_level}"

    with _get_conn() as conn:
        cur = conn.execute(
            """
            INSERT INTO games (
                created_at, player_color, skill_level, result,
                moves_san, ply_count, white_accuracy, black_accuracy, opponent_label
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now(timezone.utc).isoformat(),
                data.get("player_color", "white"),
                skill_level,
                data.get("result", "*"),
                moves_str,
                len(moves_san),
                data.get("white_accuracy"),
                data.get("black_accuracy"),
                opponent_label,
            ),
        )
        return cur.lastrowid


def list_games(limit: int = 50) -> list[dict]:
    """Lista resumida de partidas, más reciente primero. No incluye moves_san completo."""
    with _get_conn() as conn:
        rows = conn.execute(
            """
            SELECT id, created_at, player_color, skill_level, result,
                   ply_count, white_accuracy, black_accuracy, opponent_label
            FROM games
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_game(game_id: int) -> Optional[dict]:
    """Registro completo de una partida (incluye moves_san) o None si no existe."""
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM games WHERE id = ?", (game_id,)
        ).fetchone()
        if row is None:
            return None
        result = dict(row)
        result["moves_san"] = result["moves_san"].split() if result["moves_san"] else []
        return result


def delete_game(game_id: int) -> bool:
    """Borra una partida. Devuelve True si existía."""
    with _get_conn() as conn:
        cur = conn.execute("DELETE FROM games WHERE id = ?", (game_id,))
        return cur.rowcount > 0


def update_accuracy(game_id: int, white_accuracy: Optional[float] = None,
                     black_accuracy: Optional[float] = None) -> bool:
    """Actualiza la precisión calculada tras un Game Review. Devuelve True si existía."""
    with _get_conn() as conn:
        cur = conn.execute(
            """
            UPDATE games
            SET white_accuracy = COALESCE(?, white_accuracy),
                black_accuracy = COALESCE(?, black_accuracy)
            WHERE id = ?
            """,
            (white_accuracy, black_accuracy, game_id),
        )
        return cur.rowcount > 0
