# ♟ Chess Trainer

Aplicación web de entrenamiento de ajedrez contra la inteligencia artificial **Stockfish**. Diseñada especialmente para principiantes que quieren mejorar su juego con explicaciones claras en español.

---

## ✨ Características

### Juego
- **Juega contra Stockfish** con niveles de dificultad del 0 (principiante) al 20 (maestro)
- **Soporte para blancas y negras** — el tablero se gira automáticamente
- **Jaque resaltado** — el rey en jaque se muestra en rojo
- **Movimientos legales** — al seleccionar una pieza, aparecen puntos en las casillas a donde puede moverse

### Navegación del historial
- **Flechas ⏮ ◀ ▶ ⏭** debajo del tablero para retroceder y avanzar jugadas como en chess.com
- **Clic en cualquier jugada** del historial para ir directamente a esa posición
- **Teclado ← →** para navegar sin usar el ratón
- **Modo revisión** — el tablero es de solo lectura mientras revisas; el juego continúa cuando vuelves a "En vivo"

### Análisis y sugerencias
- **Sugerencias inteligentes** — las 3 mejores jugadas con explicación táctica en español
- **Estrategia del rival** — un banner explica qué busca el oponente en la posición actual (apertura / medio / final)
- **Respuesta del rival** — cada sugerencia indica qué puede hacer inmediatamente el rival después de esa jugada
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

### Editor de posición
- **Paleta de piezas** — coloca blancas y negras en cualquier casilla con un clic
- **Borrador** — elimina piezas individuales del tablero
- **Entrada de FEN** — pega cualquier FEN de un libro, Lichess, Chess.com o base de datos; el tablero actualiza en tiempo real
- **Turno / Juegas como** — elige quién mueve primero (blancas o negras); ese color es el tuyo, Stockfish juega el contrario
- Acciones rápidas: posición inicial, cargar posición actual de la partida, limpiar tablero
- **Validación** — avisa si falta un Rey o hay peones en fila 1/8 antes de aplicar
- Al aplicar la posición, el panel de sugerencias muestra inmediatamente las mejores jugadas para el turno activo

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
| Protocolo | **UCI** (via python-chess) | Comunicación con Stockfish |
| HTTP Client | **Axios** | Llamadas del frontend al backend |
| Servidor ASGI | **Uvicorn** | Ejecuta FastAPI |

---

## 📁 Estructura del proyecto

```
chess-trainer/
├── chess-backend/          # Servidor Python (FastAPI + Stockfish)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py         # Endpoints de la API REST
│   │   └── engine.py       # Wrapper de Stockfish (python-chess)
│   ├── requirements.txt    # Dependencias Python
│   └── run.py              # Punto de entrada del servidor
│
└── chess-app/              # Aplicación React (frontend)
    ├── public/
    ├── src/
    │   ├── api/
    │   │   └── chess.js    # Llamadas HTTP al backend
    │   ├── components/
    │   │   ├── Board.jsx           # Tablero interactivo (+ modo revisión)
    │   │   ├── AdvantageBar.jsx    # Barra de ventaja en centipawns
    │   │   ├── BoardEditor.jsx     # Editor de posición con paleta y entrada FEN
    │   │   ├── ChessClock.jsx      # Reloj de ajedrez con cuenta regresiva
    │   │   ├── ControlPanel.jsx    # Panel de configuración + selector de reloj
    │   │   ├── MoveHistory.jsx     # Historial clicable + replay modal
    │   │   └── MoveSuggestions.jsx # Sugerencias + estrategia rival + tips
    │   ├── App.jsx          # Componente raíz
    │   ├── App.css          # Estilos globales
    │   └── main.jsx         # Punto de entrada de React
    ├── package.json
    └── vite.config.js
```

---

## ⚙️ Requisitos previos

- **Python 3.10** o superior
- **Node.js 18** o superior
- **Stockfish** (motor de ajedrez)

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

### 4. Instalar dependencias del frontend

```bash
cd ../chess-app
npm install
```

### 5. Ejecutar el backend

Abre una terminal y activa el entorno virtual si no lo está:

```bash
cd chess-backend

# Solo en Windows — define la ruta a Stockfish:
# (cambia el nombre del .exe al que descargaste)
$env:STOCKFISH_PATH = "C:\stockfish\stockfish-windows-x86-64.exe"

# Iniciar el servidor
python run.py
```

Debes ver:
```
✅ Stockfish iniciado correctamente
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

> **Nota:** Si instalaste Stockfish con `brew install` o `apt install`, no necesitas definir `STOCKFISH_PATH` — se detecta automáticamente.

> **Tip Windows:** Para no tener que escribir `$env:STOCKFISH_PATH` cada vez, agrégala a las **Variables de entorno del sistema** en el Panel de Control → Sistema → Configuración avanzada del sistema.

### 6. Ejecutar el frontend

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

### 7. Abrir la aplicación

Abre tu navegador en: **http://localhost:5173**

---

## 🌐 Endpoints de la API

La API REST corre en `http://localhost:8000`. Puedes explorarla en:
**http://localhost:8000/docs** (documentación interactiva de FastAPI)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Verifica que el servidor y Stockfish estén activos |
| POST | `/api/move` | El bot calcula y devuelve su jugada |
| POST | `/api/hint` | Devuelve la mejor jugada sin ejecutarla |
| POST | `/api/top-moves` | Devuelve las N mejores jugadas (para sugerencias) |
| POST | `/api/evaluate` | Evalúa la posición en centipawns |
| GET | `/api/legal-moves` | Lista todos los movimientos legales para una posición |
| POST | `/api/new-game` | Devuelve el FEN de la posición inicial |

---

## 🎮 Cómo usar

1. **Elige tu color** en el panel de la derecha (blancas o negras)
2. **Ajusta el nivel** del bot (0 = muy fácil, 20 = maestro)
3. **Selecciona el tiempo** del reloj (1', 3', 5', 10', 30' o ∞) — opcional
4. **Mueve tus piezas** arrastrándolas o haciendo clic (clic en pieza → clic en destino)
5. **Consulta las sugerencias** debajo del tablero:
   - El banner naranja muestra la estrategia actual del rival
   - Cada tarjeta explica la jugada y lo que el rival podría responder
   - El tip azul al pie da un consejo de entrenamiento para esa posición
6. **Pide una pista** con "💡 Pedir pista" para ver la mejor jugada resaltada en azul
7. **Navega el historial** con ⏮ ◀ ▶ ⏭ debajo del tablero (o teclas ← →)
   - Haz clic en cualquier jugada del historial para ir directamente a esa posición
   - El tablero entra en modo revisión (solo lectura); pulsa ⏭ para volver al juego
8. Al terminar, pulsa **▶ Replay** en el historial para reproducir toda la partida

### Seguir partidas de GM / Análisis libre

1. Pulsa **⚡ Modo análisis** en el panel derecho (se ilumina en amarillo cuando está activo)
2. Mueve las piezas de **ambos colores** — blancas y negras — tú mismo
3. Después de cada jugada el panel muestra automáticamente la **mejor respuesta** para el bando que sigue
4. Reproduce movimiento a movimiento cualquier partida de un libro o torneo y compara con lo que sugiere Stockfish
5. Para volver al modo normal (con bot) pulsa el botón nuevamente

### Entrenar posiciones de libros

1. Pulsa **✎ Editor de posición** en el panel derecho
2. Selecciona una pieza de la paleta y haz clic en la casilla del tablero para colocarla
   - Botón **✕** = borrador (elimina piezas)
   - **↺ Pos. inicial** restaura la posición de partida estándar
   - **⊘ Limpiar** vacía el tablero
3. Para cargar directamente desde un libro o base de datos: pega el FEN en el campo de texto — el tablero se actualiza en tiempo real
4. Elige **Turno / Juegas como**: ese color es el tuyo; Stockfish jugará el contrario
5. Pulsa **♟ Aplicar posición** — el panel de sugerencias muestra inmediatamente las mejores jugadas

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
