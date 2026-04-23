/**
 * App.jsx — El componente raíz, el "director de orquesta"
 *
 * Responsabilidades:
 *   1. Guardar el estado global: FEN, historial, nivel, color, evaluación
 *   2. Conectar todos los componentes pasando datos (props) hacia abajo
 *      y recibiendo eventos (callbacks) hacia arriba
 *
 * Estado nuevo respecto a la versión original:
 *   - fenHistory: array con el FEN de cada posición de la partida,
 *     usado por MoveHistory para el replay de la partida
 *   - highlightMove: jugada resaltada desde el panel de sugerencias
 */

import { useState, useCallback, useEffect } from "react";
import Board          from "./components/Board";
import ControlPanel   from "./components/ControlPanel";
import AdvantageBar   from "./components/AdvantageBar";
import MoveHistory    from "./components/MoveHistory";
import MoveSuggestions from "./components/MoveSuggestions";
import { checkHealth, getHint } from "./api/chess";
import "./App.css";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function App() {

  // ── Estado del juego ────────────────────────────────────────────────────────
  const [fen, setFen]               = useState(INITIAL_FEN);
  const [moves, setMoves]           = useState([]);       // [{ san, color }]
  const [fenHistory, setFenHistory] = useState([INITIAL_FEN]); // FEN tras cada jugada
  const [gameStatus, setGameStatus] = useState({ turn: "w" });
  const [evaluation, setEvaluation] = useState({ score: 0, mateIn: null });

  // ── Configuración ────────────────────────────────────────────────────────────
  const [skillLevel, setSkillLevel]   = useState(10);
  const [playerColor, setPlayerColor] = useState("white");
  const [settings, setSettings]       = useState({
    showCoordinates:  true,
    showSquareLabels: false,
    showLastMoveSan:  true,
  });

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [hintMove, setHintMove]         = useState(null);
  const [highlightMove, setHighlightMove] = useState(null); // sugerencia en hover
  const [backendOk, setBackendOk]       = useState(null);


  // ── Verificar backend al iniciar ────────────────────────────────────────────
  useEffect(() => {
    checkHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);


  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSettingChange = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  /**
   * handleMoveMade — se llama desde Board.jsx cuando se hace una jugada.
   * Ahora también guarda el FEN resultante en fenHistory para el replay.
   *
   * currentFen: el FEN DESPUÉS de la jugada (Board lo pasa como tercer argumento)
   */
  const handleMoveMade = useCallback(({ san, color, fen: moveFen }) => {
    setMoves((prev) => [...prev, { san, color }]);
    if (moveFen) {
      setFenHistory((prev) => [...prev, moveFen]);
    }
    setHintMove(null);
    setHighlightMove(null);
  }, []);

  /**
   * handleFenChange — actualiza el FEN cuando Board nos avisa de un cambio.
   * También lo sincronizamos con fenHistory si la jugada ya fue registrada.
   */
  const handleFenChange = useCallback((newFen) => {
    setFen(newFen);
  }, []);

  const handleNewGame = useCallback(() => {
    setFen(INITIAL_FEN);
    setMoves([]);
    setFenHistory([INITIAL_FEN]);
    setGameStatus({ turn: "w" });
    setEvaluation({ score: 0, mateIn: null });
    setHintMove(null);
    setHighlightMove(null);
  }, []);

  const handleColorChange = useCallback((color) => {
    setPlayerColor(color);
    setTimeout(() => {
      setFen(INITIAL_FEN);
      setMoves([]);
      setFenHistory([INITIAL_FEN]);
      setGameStatus({ turn: "w" });
      setEvaluation({ score: 0, mateIn: null });
      setHintMove(null);
      setHighlightMove(null);
    }, 0);
  }, []);

  const handleHint = useCallback(async () => {
    if (gameStatus.gameOver || gameStatus.isThinking) return;
    try {
      const res = await getHint(fen);
      setHintMove(res.data);
    } catch (err) {
      console.error("Error al obtener pista:", err);
    }
  }, [fen, gameStatus]);

  // La jugada activa en el tablero es la pista o la sugerencia en hover
  const activeHint = hintMove ?? highlightMove;
  const lastMoveSan = moves.length > 0 ? moves[moves.length - 1].san : null;


  // ── Pantallas de carga y error ───────────────────────────────────────────────

  if (backendOk === null) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Conectando con Stockfish...</p>
      </div>
    );
  }

  if (backendOk === false) {
    return (
      <div className="error-screen">
        <div className="error-icon">⚠</div>
        <h2>Servidor no disponible</h2>
        <p>Asegúrate de que el backend está corriendo:</p>
        <code>python run.py</code>
        <p className="error-sub">El servidor debe estar en http://localhost:8000</p>
        <button onClick={() => window.location.reload()} className="btn btn-newgame">
          Reintentar
        </button>
      </div>
    );
  }


  // ── Render principal ─────────────────────────────────────────────────────────
  return (
    <div className="app">

      <header className="app-header">
        <div className="header-title">
          <span className="header-icon">♟</span>
          Chess Trainer
        </div>
        <div className="header-sub">Stockfish · Nivel {skillLevel}/20</div>
      </header>

      <main className="app-layout">

        {/* COLUMNA 1: Barra de ventaja */}
        <AdvantageBar
          score={evaluation.score}
          mateIn={evaluation.mateIn}
          height={560}
        />

        {/* COLUMNA 2: Tablero + sugerencias debajo */}
        <div className="board-col">
          <Board
            fen={fen}
            onFenChange={handleFenChange}
            onMoveMade={handleMoveMade}
            onGameStatus={setGameStatus}
            onEvaluation={setEvaluation}
            playerColor={playerColor}
            skillLevel={skillLevel}
            settings={settings}
            hintMove={activeHint}
          />

          {/*
            Panel de sugerencias debajo del tablero.
            Muestra las 3 mejores jugadas con explicaciones para principiantes.
            Al pasar el cursor sobre una sugerencia, se resalta en el tablero.
          */}
          <MoveSuggestions
            fen={fen}
            playerColor={playerColor}
            gameStatus={gameStatus}
            onHighlight={setHighlightMove}
          />
        </div>

        {/* COLUMNA 3: Panel de control + historial */}
        <div className="right-col">
          <ControlPanel
            settings={settings}
            onSettingChange={handleSettingChange}
            skillLevel={skillLevel}
            onSkillChange={setSkillLevel}
            playerColor={playerColor}
            onColorChange={handleColorChange}
            onHint={handleHint}
            onNewGame={handleNewGame}
            gameStatus={gameStatus}
            hintMove={hintMove}
            lastMoveSan={lastMoveSan}
          />

          {/*
            MoveHistory ahora también recibe fenHistory para poder
            reproducir la partida completa con el botón ▶ Replay.
          */}
          <MoveHistory
            moves={moves}
            fenHistory={fenHistory}
          />
        </div>

      </main>
    </div>
  );
}

export default App;
