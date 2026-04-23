"""
run.py — Punto de entrada para desarrollo.

Uso:
    python run.py

¿Por qué uvicorn y no flask run?
FastAPI es un framework ASGI (Asynchronous Server Gateway Interface),
más moderno que WSGI (el estándar de Flask/Django). Uvicorn es su servidor
de referencia. Para producción usarías: uvicorn app.main:app --workers 4
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",   # Acepta conexiones del frontend en localhost
        port=8000,
        reload=True,       # Reinicia automáticamente al guardar cambios
        log_level="info",
    )
