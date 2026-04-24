# ♟ Chess Trainer

Aplicación web de entrenamiento de ajedrez contra la inteligencia artificial **Stockfish**. Diseñada especialmente para principiantes que quieren mejorar su juego con explicaciones claras en español.

---

## ✨ Características

### Juego
- **Juega contra Stockfish** con niveles de dificultad del 0 (principiante) al 20 (maestro)
- **Soporte para blancas y negras** — el tablero se gira automáticamente
- **Jaque resaltado** — el rey en jaque se muestra en rojo
- **Movimientos legales** — al seleccionar una pieza, aparecen puntos en las casillas a donde puede moverse

### Deshacer / Rehacer
- **Flechas ⏮ ◀ ▶ ⏭** debajo del tablero — deshacer y rehacer jugadas como en chess.com o Word
- **⏮ / ⏭** deshacer todo de una vez / volver al final
- En modo normal deshace 2 medias jugadas a la vez (tu jugada + la del bot) para que siempre vuelva a ser tu turno
- En modo análisis deshace 1 medio movimiento a la vez
- Desde cualquier posición puedes hacer un movimiento diferente y se descarta el "futuro" almacenado (nueva línea)
- Badge **+N por rehacer** cuando hay jugadas en el stack de rehacer; **● En vivo** cuando estás en la posición actual
- **Teclado ← → y Ctrl+Z / Ctrl+Y** para deshacer/rehacer sin tocar el ratón

### Comentario de Gran Maestro (IA) 🎓

> Requiere una API key de Anthropic — ver sección [Variables de entorno](#️-variables-de-entorno-api-keys).

- **Análisis GM después de cada jugada** — tras cada par de movimientos (tuyo + el bot) aparece un panel con comentario a nivel de Gran Maestro para **ambas** jugadas
- **Razonamiento táctico y posicional** — explica por qué se hizo esa jugada, qué amenaza crea o responde, y cuál es el plan a seguir
- **Clasificación automática**: ✨ Excelente / ✓ Buena jugada / ?! Imprecisión / ? Error / ?? Error grave / 💀 Mate perdido — con color según la calidad
- **Consejo de entrenamiento personalizado** — para tu jugada, recibe un tip específico ("aprende", "mejora" o "bien hecho") basado en lo que acaba de pasar en la partida
- **Panel expandible** — cada tarjeta se puede colapsar para no ocupar espacio; puedes cerrar el panel entero con ✕

### Análisis y sugerencias
- **Sugerencias inteligentes** — las 3 mejores jugadas, cada una con explicación de POR QUÉ es buena (razón táctica + contexto de ventaja)
- **Análisis de jugada equivocada** — si no elegiste la jugada óptima, aparece una tarjeta naranja explicando qué perdiste y por qué Stockfish prefería otra jugada
- **Amenazas del rival en el tablero** — las piezas del oponente que te amenazan se resaltan en naranja; tus piezas bajo ataque muestran un borde rojo, para que veas visualmente el peligro
- **Estrategia del rival** — un banner explica qué busca el oponente en la posición actual (apertura / medio / final)
- **Respuesta del rival** — cada sugerencia indica qué puede hacer inmediatamente el rival después de esa jugada
- **Badge ★ Mejor** — la primera tarjeta está marcada con borde dorado para identificar la opción óptima
- **Tips de entrenamiento** — consejos rotativos para progresar de amateur a avanzado (apertura, táctica, endgame...)
- **Pista en el tablero** — resalta en azul la casilla de origen y destino de la mejor jugada
- **Barra de ventaja** — muestra quién va ganando en centipawns en tiempo real

### Reloj de ajedrez
- **Selector de tiempo** en el panel de control: 1', 3', 5', 10', 30' o sin límite (∞)
- **Reloj visible** con cuenta regresiva para blancas y negras
- El jugador activo se resalta en dorado; tiempo bajo (< 10 s) parpadea en rojo
- El reloj se pausa automáticamente mientras el bot piensa o el jugador revisa el historial

### Modo análisis libre
- **⚡ Modo análisis** — el jugador controla ambos colores (blancas Y negras); el bot nunca responde
- Las sugerencias de Stockfish aparecen en **cada turno** (ya sea blancas o negras) mostrando la mejor jugada disponible
- El encabezado del panel indica el turno activo: `⚡ Análisis · ♔ Turno Blancas` / `⚡ Análisis · ♚ Turno Negras`
- Ideal para reproducir partidas de GM paso a paso y entender las decisiones de ambos bandos
- Se activa/desactiva con un clic; la partida en curso no se reinicia

### Historial y replay
- **Historial de jugadas** en notación algebraica estándar (SAN)
- **Replay de partida** — modal con reproducción automática (play/pausa) y control posición a posición
- Nombre de casillas opcional en el tablero (a1, e4, h8...)

---

## 🛠 Stack tecnológico

| Capa | Tecnología | Función |
|------|-----------|---------|
| Frontend | **React 19** + **Vite 8** | Interfaz de usuario |
| UI Tablero | **react-chessboard v5** | Renderizado visual del tablero |
| Lógica de ajedrez | **chess.js v1** | Validación de movimientos, reglas |
| Backend | **Python 3.10+** + **FastAPI** | API REST |
| Motor de IA | **Stockfish 17/18** | Cálculo de jugadas |
| IA comentario | **Claude (Anthropic API)** | Análisis GM de cada jugada |
| Protocolo | **UCI** (via python-chess) | Comunicación con Stockfish |
| HTTP Client | **Axios** | Llamadas del frontend al backend |
| Servidor ASGI | **Uvicorn** | Ejecuta FastAPI |

---

## 📁 Estructura del proyecto

```
chess-trainer/
├── chess-backend/              # Servidor Python (FastAPI + Stockfish + IA)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # Endpoints de la API REST
│   │   ├── engine.py           # Wrapper de Stockfish (python-chess)
│   │   └── commentary_service.py  # Análisis GM con Claude (Anthropic)
│   ├── .env                    # ← TÚ creas este archivo (ver más abajo)
│   ├── .env.example            # Plantilla de variables de entorno
│   ├── requirements.txt        # Dependencias Python
│   └── run.py                  # Punto de entrada del servidor
│
└── chess-app/                  # Aplicación React (frontend)
    ├── public/
    ├── src/
    │   ├── api/
    │   │   └── chess.js        # Llamadas HTTP al backend
    │   ├── components/
    │   │   ├── Board.jsx               # Tablero interactivo con undo/redo
    │   │   ├── AdvantageBar.jsx        # Barra de ventaja en centipawns
    │   │   ├── ChessClock.jsx          # Reloj de ajedrez con cuenta regresida
    │   │   ├── ControlPanel.jsx        # Panel de configuración + selector de reloj
    │   │   ├── MoveCommentary.jsx      # Panel comentario GM (jugador + bot)
    │   │   ├── MoveHistory.jsx         # Historial + replay modal
    │   │   └── MoveSuggestions.jsx     # Sugerencias + estrategia rival + tips
    │   ├── App.jsx              # Componente raíz
    │   ├── App.css              # Estilos globales
    │   └── main.jsx             # Punto de entrada de React
    ├── package.json
    └── vite.config.js
```

---

## ⚙️ Requisitos previos

- **Python 3.10** o superior
- **Node.js 18** o superior
- **Stockfish** (motor de ajedrez)
- **API key de Anthropic** — para el comentario GM (opcional, pero necesaria para esa función)

---

## 🚀 Instalación y ejecución

### 1. Clonar el repositorio

```bash
git clone https://github.com/tu-usuario/chess-trainer.git
cd chess-trainer
```

### 2. Instalar Stockfish

**Windows:**
1. Descarga el `.zip` desde https://stockfishchess.org/download/
2. Extrae el `.exe` en una carpeta, por ejemplo `C:\stockfish\`
3. Anota la ruta completa del ejecutable (la necesitarás en el paso 5)

**macOS (Homebrew):**
```bash
brew install stockfish
```

**Ubuntu / Debian:**
```bash
sudo apt update && sudo apt install stockfish
```

### 3. Configurar el backend

```bash
cd chess-backend

# Crear entorno virtual
python -m venv venv

# Activar el entorno virtual
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt
```

### 4. Variables de entorno (API Keys) {#️-variables-de-entorno-api-keys}

El backend necesita un archivo `.env` dentro de la carpeta `chess-backend/` para funcionar con el comentario GM.

**Paso 1 — Consigue tu API key de Anthropic:**

1. Ve a https://console.anthropic.com y crea una cuenta (o inicia sesión)
2. En el panel izquierdo haz clic en **API Keys**
3. Pulsa **Create Key**, dale un nombre (ej. `chess-trainer`) y copia la clave — empieza con `sk-ant-...`
4. Guárdala en un lugar seguro; solo se muestra una vez

**Paso 2 — Crea el archivo `.env` en Windows:**

Abre el Bloc de notas y escribe exactamente esto (pega tu clave real):

```
ANTHROPIC_API_KEY=sk-ant-TU_CLAVE_REAL_AQUI

# Solo si Stockfish NO está en el PATH del sistema:
# STOCKFISH_PATH=C:\stockfish\stockfish-windows-x86-64-avx2.exe
```

Luego guarda como `chess-backend\.env`:
- En Bloc de notas: **Archivo → Guardar como**
- Navega a la carpeta `chess-backend`
- En "Nombre de archivo" escribe: `.env` (con el punto)
- En "Tipo" selecciona: **Todos los archivos (\*.\*)**
- Pulsa **Guardar**

> ⚠️ El archivo se llama `.env` (sin nombre antes del punto). Si Windows lo guarda como `.env.txt` no funcionará — verifica en el Explorador de Archivos que no tenga extensión `.txt`.

> 🔒 El `.env` está en `.gitignore` — nunca se sube a GitHub. Tu clave está segura.

**Sin API key:** La app funciona perfectamente (Stockfish, sugerencias, reloj, todo) — solo el panel 🎓 de comentario GM no aparecerá.

### 5. Instalar dependencias del frontend

```bash
cd ../chess-app
npm install
```

### 6. Ejecutar el backend

Abre una terminal y activa el entorno virtual si no lo está:

```bash
cd chess-backend

# Activa el entorno virtual si no lo has hecho ya:
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# Iniciar el servidor
python run.py
```

Debes ver:
```
✅ Stockfish iniciado correctamente
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

> **Nota:** Si instalaste Stockfish con `brew install` o `apt install`, no necesitas `STOCKFISH_PATH` en el `.env` — se detecta automáticamente.

> **Tip Windows (Stockfish):** Si no quieres poner `STOCKFISH_PATH` en el `.env`, también puedes agregarlo a las **Variables de entorno del sistema** en Panel de Control → Sistema → Configuración avanzada del sistema.

### 7. Ejecutar el frontend

Abre **otra terminal**:

```bash
cd chess-app
npm run dev
```

Verás:
```
  VITE v8.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

### 8. Abrir la aplicación

Abre tu navegador en: **http://localhost:5173**

---

## 🌐 Endpoints de la API

La API REST corre en `http://localhost:8000`. Puedes explorarla en:
**http://localhost:8000/docs** (documentación interactiva de FastAPI)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Verifica que el servidor y Stockfish estén activos |
| POST | `/api/new-game` | Devuelve el FEN de la posición inicial |
| POST | `/api/move` | El bot calcula y devuelve su jugada |
| POST | `/api/hint` | Devuelve la mejor jugada sin ejecutarla |
| POST | `/api/top-moves` | Devuelve las N mejores jugadas (para sugerencias) |
| POST | `/api/evaluate` | Evalúa la posición en centipawns |
| GET | `/api/legal-moves` | Lista todos los movimientos legales para una posición |
| POST | `/api/commentary` | 🎓 Análisis GM de una jugada (requiere `ANTHROPIC_API_KEY`) |

---

## 🎮 Cómo usar

1. **Elige tu color** en el panel de la derecha (blancas o negras)
2. **Ajusta el nivel** del bot (0 = muy fácil, 20 = maestro)
3. **Selecciona el tiempo** del reloj (1', 3', 5', 10', 30' o ∞) — opcional
4. **Mueve tus piezas** arrastrándolas o haciendo clic (clic en pieza → clic en destino)
5. **Lee el análisis GM** — tras cada jugada tuya y la respuesta del bot, aparece el panel 🎓 con:
   - Tu jugada clasificada (Excelente / Buena / Imprecisión / Error / Mate perdido)
   - Por qué hiciste esa jugada, qué amenaza crea y el plan a seguir
   - Lo mismo para la jugada del bot, para que entiendas su razonamiento
   - Un consejo de entrenamiento personal al pie de tu tarjeta
   - Ciérralo con ✕ o colápsa cada tarjeta haciendo clic en su cabecera
6. **Consulta las sugerencias** debajo del tablero:
   - El banner naranja muestra la estrategia actual del rival
   - Cada tarjeta explica la jugada y lo que el rival podría responder
   - El tip azul al pie da un consejo de entrenamiento para esa posición
6. **Pide una pista** con "💡 Pedir pista" para ver la mejor jugada resaltada en azul
7. **Deshaz y rehaz jugadas** con ⏮ ◀ ▶ ⏭ debajo del tablero (o ← → / Ctrl+Z / Ctrl+Y)
   - Al deshacer puedes mover de forma diferente y se crea una nueva línea
   - El badge muestra **+N por rehacer** cuando hay jugadas en el stack, o **● En vivo** en la posición actual
8. Al terminar, pulsa **▶ Replay** en el historial para reproducir toda la partida

### Seguir partidas de GM / Análisis libre

1. Pulsa **⚡ Modo análisis** en el panel derecho (se ilumina en amarillo cuando está activo)
2. Mueve las piezas de **ambos colores** — blancas y negras — tú mismo
3. Después de cada jugada el panel muestra automáticamente la **mejor respuesta** para el bando que sigue
4. Reproduce movimiento a movimiento cualquier partida de un libro o torneo y compara con lo que sugiere Stockfish
5. Para volver al modo normal (con bot) pulsa el botón nuevamente

---

## 🏗 Arquitectura

```
Navegador (React)
      │
      │  HTTP/REST (Axios)
      ▼
FastAPI (Python)  ◄──── Uvicorn (servidor ASGI)
      │
      │  UCI (protocolo estándar de motores de ajedrez)
      ▼
Stockfish (proceso externo)
```

El backend es **stateless**: cada petición lleva el FEN completo de la posición. Esto permite múltiples partidas simultáneas sin sesiones.

---

## 📝 Licencia

MIT — libre para usar, modificar y distribuir.
