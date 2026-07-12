# chess-backend/Dockerfile — FastAPI + Stockfish + python-chess
#
# Stockfish se instala desde los repos de Debian (paquete "stockfish"),
# que deja el binario en /usr/games/stockfish. engine.py ya busca esa
# ruta en STOCKFISH_PATHS, así que no hace falta configurar STOCKFISH_PATH.

FROM python:3.11-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends stockfish \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY run.py .

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# El healthcheck espera a que Stockfish esté realmente arrancado
# (el lifespan de FastAPI lo precalienta al boot) antes de reportar "healthy".
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health', timeout=3)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
