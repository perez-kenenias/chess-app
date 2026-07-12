# ♟ Chess Trainer

Aplicación web para entrenar ajedrez contra **Stockfish**, con sugerencias,
análisis de partidas (Game Review estilo chess.com), comentario de Gran Maestro
por IA y mini-cursos, todo explicado en español para principiantes.

- **Frontend:** React 19 + Vite (interfaz)
- **Backend:** Python + FastAPI + Stockfish (motor de ajedrez vía UCI)
- **IA opcional:** Claude (Anthropic) para el comentario de Gran Maestro

---

## 🔌 Puertos (resumen rápido)

| Servicio | URL | Para qué |
|----------|-----|----------|
| **Frontend (la app)** | **http://localhost:5173** | 👈 Aquí juegas. Es la única URL que necesitas abrir. |
| Backend (API) | http://localhost:8000 | La API REST. El frontend la usa por detrás. |
| Documentación API | http://localhost:8000/docs | Explorador interactivo de los endpoints (Swagger). |
| Healthcheck | http://localhost:8000/api/health | Comprueba que Stockfish está vivo. |

> **Abre siempre http://localhost:5173.** El puerto 8000 es solo para depurar.

---

## 🐳 Opción A — Correr con Docker (recomendado)

No necesitas instalar Python, Node ni Stockfish: todo vive dentro de los contenedores.

### Requisitos
- **Docker Desktop** (Windows/Mac) o **Docker Engine + plugin `docker-compose-plugin`** (Linux).
- **Docker Desktop debe estar ABIERTO y corriendo** antes de escribir cualquier comando — busca el ícono de la ballena 🐳 en la barra de tareas/menú y espera a que diga "Docker Desktop is running". Si intentas `docker compose up` con Docker Desktop cerrado, el comando falla con un error de conexión (`error during connect` / `docker daemon is not running`).
- En Windows, Docker Desktop debe usar el backend **WSL2** (Settings → General → "Use the WSL 2 based engine"). Es la opción por defecto en instalaciones nuevas.

### 1. (Opcional) API key para el comentario GM
```bash
cd chess-backend
cp .env.example .env
# Edita .env y pega tu ANTHROPIC_API_KEY (ver sección "Variables de entorno")
cd ..
```
Si te lo saltas, la app funciona igual — solo el panel 🎓 de comentario GM no aparecerá.

### 2. Levantar todo con un comando
Desde la carpeta raíz `chess-trainer/`:
```bash
docker compose up --build
```
Esto:
1. Construye el backend (Python 3.11 + Stockfish instalado vía `apt`).
2. Construye el frontend (build de producción con Vite, servido por nginx).
3. Arranca el backend y espera a que su healthcheck confirme que Stockfish está listo.
4. Arranca el frontend; su nginx reenvía todo lo que llega a `/api/*` al backend.

Verás algo como:
```
✔ Container chess-trainer-backend   Healthy
✔ Container chess-trainer-frontend  Started
```
La primera vez tarda más (descarga imágenes base + `npm ci` + `pip install`).
El backend puede tardar hasta ~30-60s extra en pasar a "Healthy" porque
Stockfish se precalienta al arrancar — es normal, espera a ver "Healthy".

### 3. Verificar que los dos contenedores están corriendo
Antes de abrir el navegador, confirma en otra terminal:
```bash
docker compose ps
```
Debes ver **dos** filas, ambas en estado `Up` (o `Up (healthy)`):
```
NAME                       STATUS
chess-trainer-backend      Up (healthy)
chess-trainer-frontend     Up (healthy)
```
- Si `chess-trainer-frontend` **no aparece** o está en `Created` (nunca arrancó):
  es porque está esperando a que el backend esté `healthy` y este nunca lo logró.
  Revisa `docker compose logs backend`.
- Si algún contenedor dice `Exited` o `Restarting`: revisa sus logs
  (`docker compose logs backend` / `docker compose logs frontend`) — el error
  exacto va a estar ahí.

### 4. Abrir la app
👉 **http://localhost:5173**

Si `localhost` no responde en el navegador (pero `docker compose ps` sí muestra
los dos contenedores `Up`), prueba **http://127.0.0.1:5173** — en algunas
configuraciones de Docker Desktop en Windows `localhost` no resuelve bien
aunque el puerto sí esté publicado.

El frontend llama a `/api/...` (mismo origen, sin CORS) y nginx lo reenvía al backend.

### Comandos útiles
```bash
docker compose up -d --build        # levantar en segundo plano
docker compose logs -f backend      # ver logs del backend en vivo
docker compose logs -f frontend     # ver logs de nginx (frontend)
docker compose down                 # detener y eliminar los contenedores
docker compose up --build backend   # reconstruir solo el backend tras un cambio
```

### 🛑 Cómo apagar los contenedores

Depende de cómo los levantaste:

**Si usaste `docker compose up --build` (en primer plano, viendo los logs):**
1. Ve a la terminal donde está corriendo y presiona **`Ctrl + C`**.
   Esto **detiene** los contenedores (equivale a `docker compose stop`).
2. (Opcional) Para además **eliminarlos**, ejecuta:
   ```bash
   docker compose down
   ```

**Si usaste `docker compose up -d` (en segundo plano):**
No hay terminal que cerrar — apágalos con un comando desde la carpeta del proyecto:
```bash
docker compose down
```

**Diferencia entre `stop` y `down`:**

| Comando | Qué hace | Cuándo usarlo |
|---------|----------|---------------|
| `docker compose stop` | Solo **pausa** los contenedores. Siguen existiendo y arrancan más rápido después con `docker compose start`. | Vas a volver a usar la app pronto y no cambiaste código. |
| `docker compose down` | **Detiene y elimina** los contenedores y la red. La próxima vez se crean de nuevo (rápido, las imágenes ya están construidas). | Terminaste por hoy, o quieres un arranque limpio. Es la opción recomendada. |
| `docker compose down -v` | Igual que `down` pero además **borra los volúmenes** (⚠ se pierden datos persistidos, como el historial de partidas guardadas). | Solo si quieres resetear la app a cero. |

**Verificar que quedaron apagados:**
```bash
docker compose ps
```
Si no aparece ninguna fila (o dicen `Exited`), ya están apagados. ✅

> 💡 `docker compose down` **no borra** las imágenes construidas ni tu código —
> la próxima vez que hagas `docker compose up` arranca en segundos sin reconstruir
> (salvo que uses `--build`).

### Cambiar de puerto (si 5173 u 8000 están ocupados)
Edita `docker-compose.yml`. Los puertos son `"HOST:CONTENEDOR"` — cambia solo el
número de la izquierda (el del host):
```yaml
  frontend:
    ports:
      - "3000:80"      # ahora la app está en http://localhost:3000
  backend:
    ports:
      - "8001:8000"    # la API queda en http://localhost:8001
```
El frontend habla con el backend por el **nombre del servicio** (`backend`), no por
el puerto del host, así que no hay que tocar nada más. Reconstruye con `docker compose up --build`.

---

## 💻 Opción B — Correr sin Docker (manual)

Necesitarás **dos terminales abiertas a la vez**: una para el backend y otra para el frontend.

### Requisitos previos
- **Python 3.10+**
- **Node.js 18+**
- **Stockfish** (motor de ajedrez)
- **API key de Anthropic** (opcional, solo para el comentario GM)

### 1. Instalar Stockfish
- **Windows:** descarga el `.zip` de https://stockfishchess.org/download/, extrae el `.exe` (ej. `C:\stockfish\`) y anota su ruta completa.
- **macOS:** `brew install stockfish`
- **Ubuntu/Debian:** `sudo apt update && sudo apt install stockfish`

> Si lo instalaste con `brew` o `apt`, se detecta solo. En Windows quizá tengas que
> indicar la ruta con `STOCKFISH_PATH` en el `.env` (ver más abajo).

### 2. Backend (Terminal 1) → puerto **8000**
```bash
cd chess-backend

# Crear el entorno virtual (solo la primera vez)
python -m venv venv

# Activarlo
#   Windows (PowerShell):
venv\Scripts\activate
#   macOS / Linux:
source venv/bin/activate

# Instalar dependencias (solo la primera vez)
pip install -r requirements.txt

# Arrancar el servidor
python run.py
```
Deberías ver:
```
✅ Stockfish iniciado correctamente
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```
> **`ModuleNotFoundError`** → falta el `pip install -r requirements.txt` con el venv activado.

### 3. Frontend (Terminal 2) → puerto **5173**
```bash
cd chess-frontend

# Instalar dependencias (solo la primera vez)
npm install

# Arrancar el servidor de desarrollo
npm run dev
```
Verás:
```
  VITE v8.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

### 4. Abrir la app
👉 **http://localhost:5173** (con las dos terminales corriendo)

### Cambiar de puerto sin Docker
- **Backend en otro puerto:**
  ```bash
  python -m uvicorn app.main:app --port 8001
  ```
- **Frontend apuntando a ese backend:**
  ```bash
  # macOS / Linux
  VITE_API_URL=http://localhost:8001/api npm run dev
  # Windows (PowerShell)
  $env:VITE_API_URL="http://localhost:8001/api"; npm run dev
  ```
Sin Docker el frontend llama al backend directamente por su URL (por eso existe
`VITE_API_URL`); por defecto usa `http://localhost:8000/api`.

---

## ⚙️ Variables de entorno (API keys)

El backend lee un archivo `.env` dentro de `chess-backend/`.

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `ANTHROPIC_API_KEY` | No | Habilita el comentario GM 🎓 con Claude. Empieza con `sk-ant-...`. Consíguela en https://console.anthropic.com → **API Keys** → **Create Key**. |
| `STOCKFISH_PATH` | No | Ruta al binario de Stockfish. Solo si **no** está en el PATH (típico en Windows). Ej: `C:\stockfish\stockfish-windows-x86-64-avx2.exe`. |

Ejemplo de `chess-backend/.env`:
```
ANTHROPIC_API_KEY=sk-ant-TU_CLAVE_REAL_AQUI

# Solo si Stockfish NO está en el PATH:
# STOCKFISH_PATH=C:\stockfish\stockfish-windows-x86-64-avx2.exe
```

> 🔒 El `.env` está en `.gitignore`: nunca se sube a GitHub.
> **Sin API key la app funciona igual** (Stockfish, sugerencias, reloj, análisis, todo) — solo se oculta el panel 🎓.

---

## 🌐 Endpoints de la API

Base: `http://localhost:8000/api` · Documentación interactiva: `http://localhost:8000/docs`

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET  | `/api/health` | Verifica que el servidor y Stockfish estén activos |
| POST | `/api/new-game` | Devuelve el FEN de la posición inicial |
| POST | `/api/move` | El bot calcula y devuelve su jugada |
| POST | `/api/hint` | Devuelve la mejor jugada sin ejecutarla |
| POST | `/api/top-moves` | Devuelve las N mejores jugadas (sugerencias) |
| POST | `/api/evaluate` | Evalúa la posición en centipawns |
| GET  | `/api/legal-moves` | Movimientos legales para una posición |
| POST | `/api/commentary` | 🎓 Análisis GM de una jugada (requiere `ANTHROPIC_API_KEY`) |
| POST | `/api/analyze-move` | 🔍 Analiza una jugada de partida importada (Game Review) |
| GET  | `/api/chesscom/{user}/archives` | Meses con partidas de un usuario de chess.com |
| GET  | `/api/chesscom/{user}/games/{año}/{mes}` | Partidas del mes con PGN completo |

El backend es **stateless**: cada petición lleva el FEN completo, así que no hay
sesiones y se pueden jugar varias partidas a la vez.

---

## 🩺 Solución de problemas

| Síntoma | Causa probable | Solución |
|---------|----------------|----------|
| `localhost:5173` no carga nada (ni error, ni spinner) con Docker | Docker Desktop no está corriendo, o el contenedor `frontend` nunca arrancó | 1) Confirma que Docker Desktop dice "running". 2) `docker compose ps` — si `frontend` no está `Up`, revisa `docker compose logs backend` (probablemente el backend nunca quedó `healthy` y el frontend se quedó esperando por el `depends_on`). 3) Prueba `http://127.0.0.1:5173` en vez de `localhost`. |
| `docker compose up` da `error during connect` / `Cannot connect to the Docker daemon` | Docker Desktop está cerrado | Abre Docker Desktop, espera al ícono 🐳 verde/estable, reintenta |
| `docker compose up --build` falla al construir el backend (apt-get / stockfish) | Sin internet o VPN/firewall corporativo bloqueando la descarga de paquetes durante el build | Revisa tu conexión, desactiva VPN temporalmente, o reintenta `docker compose build backend` |
| Contenedor `backend` en estado `Restarting` o `Exited` | Crasheó al iniciar (puerto ocupado dentro del contenedor es raro, más común: excepción en el código) | `docker compose logs backend` y busca el traceback de Python |
| La app abre pero el bot no mueve / no hay sugerencias | El backend no está corriendo o Stockfish no se encontró | Revisa la Terminal 1 (`python run.py`) o `docker compose logs -f backend`. Verifica http://localhost:8000/api/health |
| `No se encontró Stockfish` | Stockfish no está en el PATH | Instálalo (ver arriba) o define `STOCKFISH_PATH` en `.env` |
| `ModuleNotFoundError` al arrancar el backend | Falta instalar dependencias | Activa el venv y ejecuta `pip install -r requirements.txt` |
| El panel 🎓 de comentario GM no aparece | Falta `ANTHROPIC_API_KEY` | Añádela en `chess-backend/.env` (opcional) |
| `port is already allocated` / `EADDRINUSE` | El puerto 5173 u 8000 ya está en uso (a veces por un `npm run dev` nativo que dejaste corriendo) | Cierra ese proceso o cambia el puerto (ver "Cambiar de puerto" en cada opción) |
| La web dice "File not found" o queda en blanco | Caché del navegador | Recarga con **Ctrl/Cmd + Shift + R** |

**Comandos de diagnóstico rápido con Docker:**
```bash
docker compose ps               # estado de cada contenedor (Up/Exited/healthy)
docker compose logs backend     # log completo del backend (errores de Python/Stockfish)
docker compose logs frontend    # log de nginx
docker compose down && docker compose up --build   # reinicio limpio desde cero
```

---

## 🏗 Arquitectura

```
Navegador (React, :5173)
      │  HTTP/REST
      ▼
FastAPI (Python, :8000)  ◄── Uvicorn
      │  UCI
      ▼
Stockfish (proceso externo)
```
Con Docker, nginx (dentro del frontend) hace de proxy `/api → backend:8000`, así que
el navegador solo habla con un origen (`:5173`) y no hay problemas de CORS.

---

## 📝 Licencia

MIT — libre para usar, modificar y distribuir.
