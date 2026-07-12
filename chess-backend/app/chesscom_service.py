"""
chesscom_service.py — Cliente de la API pública de chess.com.

chess.com expone una API REST pública y gratuita (sin API key) en
https://api.chess.com/pub/. Este módulo la consulta desde el backend
en lugar del navegador por dos razones:

  1. chess.com exige un header User-Agent identificable; los navegadores
     no permiten sobreescribirlo desde JavaScript.
  2. Evita problemas de CORS.

Endpoints usados:
  GET /pub/player/{user}/games/archives      → lista de meses con partidas
  GET /pub/player/{user}/games/{YYYY}/{MM}   → partidas de ese mes (con PGN)
"""

import httpx

CHESSCOM_API = "https://api.chess.com/pub"
HEADERS = {"User-Agent": "chess-trainer-local (uso personal de entrenamiento)"}
TIMEOUT = 15.0


async def get_archives(username: str) -> list[str]:
    """Devuelve la lista de URLs de archivos mensuales del jugador."""
    url = f"{CHESSCOM_API}/player/{username.lower().strip()}/games/archives"
    async with httpx.AsyncClient(headers=HEADERS, timeout=TIMEOUT) as client:
        resp = await client.get(url)
        if resp.status_code == 404:
            raise ValueError(f"El usuario '{username}' no existe en chess.com")
        resp.raise_for_status()
        return resp.json().get("archives", [])


async def get_games(username: str, year: int, month: int) -> list[dict]:
    """Devuelve las partidas de un mes, ya resumidas para el frontend.

    Cada partida incluye el PGN completo más metadatos para la lista:
    jugadores, ratings, resultado, control de tiempo y fecha.
    """
    url = (f"{CHESSCOM_API}/player/{username.lower().strip()}"
           f"/games/{year}/{month:02d}")
    async with httpx.AsyncClient(headers=HEADERS, timeout=TIMEOUT) as client:
        resp = await client.get(url)
        if resp.status_code == 404:
            raise ValueError(f"Sin partidas para '{username}' en {year}-{month:02d}")
        resp.raise_for_status()
        raw_games = resp.json().get("games", [])

    games = []
    for g in raw_games:
        if "pgn" not in g:
            continue  # partidas de variantes sin PGN estándar
        white = g.get("white", {})
        black = g.get("black", {})
        games.append({
            "url": g.get("url", ""),
            "pgn": g["pgn"],
            "time_class": g.get("time_class", ""),      # bullet/blitz/rapid/daily
            "time_control": g.get("time_control", ""),
            "end_time": g.get("end_time", 0),            # epoch seconds
            "rated": g.get("rated", False),
            "white": {
                "username": white.get("username", "?"),
                "rating": white.get("rating", 0),
                "result": white.get("result", ""),        # win/checkmated/timeout...
            },
            "black": {
                "username": black.get("username", "?"),
                "rating": black.get("rating", 0),
                "result": black.get("result", ""),
            },
        })

    # Más recientes primero — es lo que el usuario quiere revisar
    games.sort(key=lambda x: x["end_time"], reverse=True)
    return games
