/**
 * App.jsx — El componente raíz, el "director de orquesta"
 *
 * Responsabilidades:
 *   1. Guardar el estado global: FEN, historial, nivel, color, evaluación
 *   2. Navegación del historial (viewIdx) para revisar jugadas pasadas
 *   3. Reloj de ajedrez con tiempo seleccionable
 *   4. Conectar todos los componentes pasando datos y callbacks
 */

import { useState, useCallback, useEffect, useRef } from "react";
import Board           from "./components/Board";
import ControlPanel    from "./components/ControlPanel";
import AdvantageBar    from "./components/AdvantageBar";
import MoveHistory     from "./components/MoveHistory";
import MoveSuggestions from "./components/MoveSuggestions";
import ChessClock      from "./components/ChessClock";
import { checkHealth, getHint } from "./api/chess";
import "./App.css";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function App() {

  // ── Estado del juego ────────────────────────────────────────────────────────
  const [fen, setFen]               = useState(INITIAL_FEN);
  const [moves, setMoves]           = useState([]);       // [{ san, color }]
  const [fenHistory, setFenHistory] = useState([INITIAL_FEN]);
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

  // ── Navegación de historial ──────────────────────────────────────────────────
  // null = posición viva/actual · 0..n = revisando fenHistory[viewIdx]
  const [viewIdx, setViewIdx] = useState(null);

  // ── Reloj de ajedrez ─────────────────────────────────────────────────────────
  const [clockMinutes, setClockMinutes] = useState(0); // 0 = sin límite
  const [whiteTime, setWhiteTime]       = useState(null);
  const [blackTime, setBlackTime]       = useState(null);

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [hintMove, setHintMove]           = useState(null);
  const [highlightMove, setHighlightMove] = useState(null);
  const [backendOk, setBackendOk]         = useState(null);

  // ── Refs para el tick del reloj (sin stale closures) ───────────────────────
  const gameStatusRef = useRef(gameStatus);
  useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);
  const viewIdxRef = useRef(viewIdx);
  useEffect(() => { viewIdxRef.current = viewIdx; }, [viewIdx]);

  // ── Verificar backend al iniciar ────────────────────────────────────────────
  useEffect(() => {
    checkHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  // ── Tick del reloj cada segundo ─────────────────────────────────────────────
  // El intervalo se crea una sola vez (cuando el modo pasa de unlimited → timed).
  // Dentro del callback leemos refs para evitar stale closures.
  useEffect(() => {
    if (whiteTime === null) return;
    const id = setInterval(() => {
      const { turn, gameOver, isThinking } = gameStatusRef.current;
      if (gameOver || isThinking || viewIdxRef.current !== null) return;
      if (turn === "w") {
        setWhiteTime(t => Math.max(0, t - 1));
      } else {
        setBlackTime(t => Math.max(0, t - 1));
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whiteTime !== null]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleSettingChange = useCallback((key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleMoveMade = useCallback(({ san, color, fen: moveFen }) => {
    setMoves((prev) => [...prev, { san, color }]);
    if (moveFen) {
      setFenHistory((prev) => [...prev, moveFen]);
    }
    setHintMove(null);
    setHighlightMove(null);
    setViewIdx(null); // jugada nueva → volver a posición viva
  }, []);

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
    setViewIdx(null);
    if (clockMinutes > 0) {
      setWhiteTime(clockMinutes * 60);
      setBlackTime(clockMinutes * 60);
    }
  }, [clockMinutes]);

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
      setViewIdx(null);
      if (clockMinutes > 0) {
        setWhiteTime(clockMinutes * 60);
        setBlackTime(clockMinutes * 60);
      }
    }, 0);
  }, [clockMinutes]);

  const handleClockChange = useCallback((minutes) => {
    setClockMinutes(minutes);
    if (minutes === 0) {
      setWhiteTime(null);
      setBlackTime(null);
    } else {
      setWhiteTime(minutes * 60);
      setBlackTime(minutes * 60);
    }
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

  // ── Navegación del historial ─────────────────────────────────────────────────

  const handleNavPrev = useCallback(() => {
    setViewIdx(prev => {
      if (prev === 0) return 0;
      if (prev === null) return Math.max(0, fenHistory.length - 2);
      return prev - 1;
    });
  }, [fenHistory.length]);

  const handleNavNext = useCallback(() => {
    setViewIdx(prev => {
      if (prev === null) return null;
      if (prev >= fenHistory.length - 1) return null; // último → volver a vivo
      return prev + 1;
    });
  }, [fenHistory.length]);

  // Teclado: ← → para navegar (solo cuando hay jugadas y no se está escribiendo)
  useEffect(() => {
    if (moves.length === 0) return;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft")  { e.preventDefault(); handleNavPrev(); }
      if (e.key === "ArrowRight") { e.preventDefault(); handleNavNext(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleNavPrev, handleNavNext, moves.length]);

  // ── Derivados ────────────────────────────────────────────────────────────────
  const activeHint  = hintMove ?? highlightMove;
  const lastMoveSan = moves.length > 0 ? moves[moves.length - 1].san : null;
  const reviewFen   = viewIdx !== null ? fenHistory[viewIdx] : null;
  const activeColor = gameStatus.turn === "w" ? "white" : "black";


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
          height={640}
        />

        {/* COLUMNA 2: Tablero + flechas de navegación + sugerencias */}
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
            reviewFen={reviewFen}
          />

          {/* Flechas de navegación — como chess.com */}
          {moves.length > 0 && (
            <div className="nav-arrows">
              <button
                className="nav-btn"
                onClick={() => setViewIdx(0)}
                disabled={viewIdx === 0}
                title="Posición inicial"
              >⏮</button>

              <button
                className="nav-btn"
                onClick={handleNavPrev}
                disabled={viewIdx === 0}
                title="Jugada anterior (←)"
              >◀</button>

              {viewIdx !== null ? (
                <span className="nav-badge">
                  Revisando {viewIdx}/{fenHistory.length - 1}
                </span>
              ) : (
                <span className="nav-badge nav-badge-live">● En vivo</span>
              )}

              <button
                className="nav-btn"
                onClick={handleNavNext}
                disabled={viewIdx === null}
                title="Jugada siguiente (→)"
              >▶</button>

              <button
                className="nav-btn"
                onClick={() => setViewIdx(null)}
                disabled={viewIdx === null}
                title="Volver a posición actual"
              >⏭</button>
            </div>
          )}

          {/* Sugerencias solo en modo vivo (no durante revisión) */}
          {viewIdx === null && (
            <MoveSuggestions
              fen={fen}
              playerColor={playerColor}
              gameStatus={gameStatus}
              onHighlight={setHighlightMove}
            />
          )}
        </div>

        {/* COLUMNA 3: Reloj + Panel de control + historial */}
        <div className="right-col">

          <ChessClock
            whiteTime={whiteTime}
            blackTime={blackTime}
            activeColor={activeColor}
            gameOver={gameStatus.gameOver}
          />

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
            clockMinutes={clockMinutes}
            onClockChange={handleClockChange}
          />

          <MoveHistory
            moves={moves}
            fenHistory={fenHistory}
            viewIdx={viewIdx}
            onNavigate={setViewIdx}
          />
        </div>

      </main>
    </div>
  );
}

export default App;
