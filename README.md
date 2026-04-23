# ♟ Chess Trainer

Aplicación web de entrenamiento de ajedrez contra la inteligencia artificial **Stockfish**. Diseñada especialmente para principiantes que quieren mejorar su juego con explicaciones claras en español.

---

## ✨ Características

- **Juega contra Stockfish** con niveles de dificultad del 0 (principiante) al 20 (maestro)
- **Sugerencias inteligentes** — antes de mover, el panel muestra las 3 mejores jugadas con explicaciones en lenguaje natural
- **Pista en el tablero** — resalta la casilla de origen y destino de la mejor jugada
- **Barra de ventaja** — muestra quién va ganando en centipawns en tiempo real
- **Historial de jugadas** en notación algebraica estándar (SAN)
- **Replay de partida** — reproduce cualquier partida movimiento a movimiento con controles de reproducción
- **Jaque resaltado** — el rey en jaque se muestra en rojo
- **Movimientos legales** — al seleccionar una pieza, aparecen puntos en las casillas a donde puede moverse
- **Soporte para blancas y negras** — el tablero se gira automáticamente
- Nombre de casillas opcional (a1, e4, h8...)

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
    │   │   ├── Board.jsx           # Tablero interactivo
    │   │   ├── AdvantageBar.jsx    # Barra de ventaja
    │   │   ├── ControlPanel.jsx    # Panel de configuración
    │   │   ├── MoveHistory.jsx     # Historial + replay
    │   │   └── MoveSuggestions.jsx # Sugerencias para principiantes
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
3. **Mueve tus piezas** arrastrándolas o haciendo clic (clic en la pieza → clic en el destino)
4. **Consulta el panel de sugerencias** debajo del tablero para ver las mejores opciones antes de mover
5. **Pide una pista** con el botón "💡 Pedir pista" para resaltar la mejor jugada en azul
6. Al terminar la partida, pulsa **▶ Replay** en el historial para ver toda la partida

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
