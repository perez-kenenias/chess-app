/**
 * App.jsx — El componente raíz, el "director de orquesta"
 *
 * Responsabilidades:
 *   1. Estado global: FEN, historial, nivel, color, evaluación
 *   2. Deshacer / Rehacer (undo/redo) — como chess.com / Word
 *   3. Reloj de ajedrez con tiempo seleccionable
 *   4. Modo análisis libre (mueve ambos colores, sugerencias siempre visibles)
 *   5. Conectar todos los componentes pasando datos y callbacks
 */

import { useState, useCallback, useEffect, useRef } from "react";
import Board           from "./components/Board";
import ControlPanel    from "./components/ControlPanel";
import AdvantageBar    from "./components/AdvantageBar";
import MoveHistory     from "./components/MoveHistory";
import MoveSuggestions   from "./components/MoveSuggestions";
import MoveAnalysisCard  from "./components/MoveAnalysisCard";
import MoveCommentary    from "./components/MoveCommentary";
import ChessClock        from "./components/ChessClock";
import { checkHealth, getHint, getCommentary } from "./api/chess";
import "./App.css";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function App() {

  // ── Estado del juego ────────────────────────────────────────────────────────
  const [fen, setFen]               = useState(INITIAL_FEN);
  const [moves, setMoves]           = useState([]);
  const [fenHistory, setFenHistory] = useState([INITIAL_FEN]);
  const [gameStatus, setGameStatus] = useState({ turn: "w" });
  const [evaluation, setEvaluation] = useState({ score: 0, mateIn: null });

  // ── Deshacer / Rehacer ───────────────────────────────────────────────────────
  // futureMoves[0] = primera jugada a rehacer (orden cronológico)
  const [futureMoves,      setFutureMoves]      = useState([]);
  const [futureFenHistory, setFutureFenHistory] = useState([]);

  // ── Configuración ────────────────────────────────────────────────────────────
  const [skillLevel, setSkillLevel]   = useState(10);
  const [playerColor, setPlayerColor] = useState("white");
  const [settings, setSettings]       = useState({
    showCoordinates:  true,
    showSquareLabels: false,
    showLastMoveSan:  true,
  });

  // ── Modo análisis libre ───────────────────────────────────────────────────────
  const [analysisMode, setAnalysisMode] = useState(false);

  // ── Reloj ────────────────────────────────────────────────────────────────────
  const [clockMinutes, setClockMinutes] = useState(0);
  const [whiteTime, setWhiteTime]       = useState(null);
  const [blackTime, setBlackTime]       = useState(null);

  // ── UI ───────────────────────────────────────────────────────────────────────
  const [hintMove, setHintMove]             = useState(null);
  const [highlightMove, setHighlightMove]   = useState(null);
  const [backendOk, setBackendOk]           = useState(null);
  const [opponentSquares, setOpponentSquares] = useState({});

  // ── Análisis de jugada equivocada ────────────────────────────────────────────
  // lastPlayerMove = { san, fenBefore } — guardado cuando el jugador mueve (no el bot)
  const [lastPlayerMove, setLastPlayerMove] = useState(null);
  // wrongMoveInfo = datos del análisis de la última jugada subóptima del jugador
  const [wrongMoveInfo, setWrongMoveInfo]   = useState(null);
  // missedMoveHighlight = resaltado en el tablero de la jugada que debió hacerse
  const [missedMoveHighlight, setMissedMoveHighlight] = useState(null);

  // ── Comentario de Gran Maestro ────────────────────────────────────────────────
  // lastBotMove = { san, uci, fenBefore, fenAfter } — última jugada del bot
  const [lastBotMove, setLastBotMove]         = useState(null);
  // commentary = { loading, player: {...}, bot: {...} } — comentario GM actual
  const [commentary, setCommentary]           = useState(null);
  // gmCommentaryEnabled — el usuario puede desactivarlo para no consumir tokens
  const [gmCommentaryEnabled, setGmCommentaryEnabled] = useState(true);
  // Ref para acceder a lastPlayerMove dentro de efectos async sin stale closure
  const lastPlayerMoveRef = useRef(null);

  // ── Refs para el reloj ───────────────────────────────────────────────────────
  const gameStatusRef = useRef(gameStatus);
  useEffect(() => { gameStatusRef.current = gameStatus; }, [gameStatus]);

  // ── Verificar backend ────────────────────────────────────────────────────────
  useEffect(() => {
    checkHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  // ── Tick del reloj ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (whiteTime === null) return;
    const id = setInterval(() => {
      const { turn, gameOver, isThinking } = gameStatusRef.current;
      if (gameOver || isThinking) return;
      if (turn === "w") setWhiteTime(t => Math.max(0, t - 1));
      else              setBlackTime(t => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whiteTime !== null]);

  // ── Helpers internos ─────────────────────────────────────────────────────────

  const _resetUI = useCallback(() => {
    setHintMove(null);
    setHighlightMove(null);
    setMissedMoveHighlight(null);
  }, []);

  // ── useEffect: sincronizar ref con el estado de lastPlayerMove ───────────────
  useEffect(() => { lastPlayerMoveRef.current = lastPlayerMove; }, [lastPlayerMove]);

  // ── useEffect: pedir comentario GM cuando el bot responde ───────────────────
  useEffect(() => {
    if (!lastBotMove) return;
    if (!gmCommentaryEnabled) return;   // ← desactivado por el usuario
    const pm = lastPlayerMoveRef.current;
    if (!pm) return;

    setCommentary({ loading: true, player: null, bot: null });

    const botColor = playerColor === "white" ? "black" : "white";

    Promise.all([
      getCommentary(pm.fenBefore, pm.fenAfter, pm.san, pm.uci, playerColor, false, skillLevel),
      getCommentary(lastBotMove.fenBefore, lastBotMove.fenAfter, lastBotMove.san, lastBotMove.uci, botColor, true, skillLevel),
    ])
      .then(([pRes, bRes]) => {
        setCommentary({ loading: false, player: pRes.data, bot: bRes.data });
      })
      .catch((err) => {
        const detail = err?.response?.data?.detail ?? err?.message ?? String(err);
        console.error("❌ Error comentario GM:", detail);
        setCommentary({ loading: false, error: true, errorMsg: detail });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastBotMove, gmCommentaryEnabled]);

  /**
   * handleWrongMove — recibe el análisis de la jugada subóptima desde MoveSuggestions.
   * Actualiza el estado y extrae las casillas para resaltar en el tablero.
   */
  const handleWrongMove = useCallback((info) => {
    setWrongMoveInfo(info);
    if (info?.suggestedFrom && info?.suggestedTo) {
      setMissedMoveHighlight({ from_square: info.suggestedFrom, to_square: info.suggestedTo });
    } else {
      setMissedMoveHighlight(null);
    }
  }, []);

  // ── Handlers principales ─────────────────────────────────────────────────────

  const handleSettingChange = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  /**
   * handleMoveMade — llegada cada vez que Board hace una jugada.
   * Agrega al historial, guarda datos para el comentario GM y borra el stack de rehacer.
   *
   * Board.jsx ahora pasa también:
   *   uci:       jugada en formato UCI ("e2e4", "g1f3")
   *   fenBefore: FEN antes del movimiento (para el comentario GM)
   */
  const handleMoveMade = useCallback(({ san, uci = "", color, fen: moveFen, fenBefore }) => {
    setMoves(prev => [...prev, { san, color }]);
    if (moveFen) setFenHistory(prev => [...prev, moveFen]);
    // Al hacer una jugada nueva se descarta cualquier "futuro" almacenado
    setFutureMoves([]);
    setFutureFenHistory([]);

    if (!analysisMode && color === playerColor) {
      // Jugada del JUGADOR: guardar para análisis de error y comentario GM
      const fb = fenBefore ?? fen;
      setLastPlayerMove({ san, fenBefore: fb, uci, fenAfter: moveFen });
      // El ref se actualiza en el useEffect de sincronización
    }

    if (!analysisMode && color !== playerColor) {
      // Jugada del BOT: disparar comentario GM al recibir la respuesta
      setLastBotMove({ san, uci, fenBefore: fenBefore ?? fen, fenAfter: moveFen });
    }

    _resetUI();
  }, [_resetUI, analysisMode, playerColor, fen]);

  const handleFenChange = useCallback((newFen) => {
    setFen(newFen);
  }, []);

  const handleNewGame = useCallback(() => {
    setFen(INITIAL_FEN);
    setMoves([]);
    setFenHistory([INITIAL_FEN]);
    setFutureMoves([]);
    setFutureFenHistory([]);
    setGameStatus({ turn: "w" });
    setEvaluation({ score: 0, mateIn: null });
    setLastPlayerMove(null);
    setLastBotMove(null);
    setCommentary(null);
    setWrongMoveInfo(null);
    setOpponentSquares({});
    _resetUI();
    if (clockMinutes > 0) {
      setWhiteTime(clockMinutes * 60);
      setBlackTime(clockMinutes * 60);
    }
  }, [clockMinutes, _resetUI]);

  const handleColorChange = useCallback((color) => {
    setPlayerColor(color);
    setTimeout(() => {
      setFen(INITIAL_FEN);
      setMoves([]);
      setFenHistory([INITIAL_FEN]);
      setFutureMoves([]);
      setFutureFenHistory([]);
      setGameStatus({ turn: "w" });
      setEvaluation({ score: 0, mateIn: null });
      setLastPlayerMove(null);
      setLastBotMove(null);
      setCommentary(null);
      setWrongMoveInfo(null);
      setOpponentSquares({});
      _resetUI();
      if (clockMinutes > 0) {
        setWhiteTime(clockMinutes * 60);
        setBlackTime(clockMinutes * 60);
      }
    }, 0);
  }, [clockMinutes, _resetUI]);

  const handleClockChange = useCallback((minutes) => {
    setClockMinutes(minutes);
    if (minutes === 0) { setWhiteTime(null); setBlackTime(null); }
    else { setWhiteTime(minutes * 60); setBlackTime(minutes * 60); }
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

  const handleToggleAnalysis = useCallback(() => {
    setAnalysisMode(prev => !prev);
  }, []);

  // ── Deshacer / Rehacer ───────────────────────────────────────────────────────

  /**
   * handleUndo — deshace jugadas.
   *
   * En modo vs-bot deshace 2 half-moves (tu jugada + respuesta del bot)
   * para que siempre vuelva a ser tu turno.
   * En modo análisis deshace 1 half-move a la vez.
   */
  const handleUndo = useCallback(() => {
    if (moves.length === 0 || gameStatus.isThinking) return;

    const count = (!analysisMode && moves.length >= 2) ? 2 : 1;

    const newMoves      = moves.slice(0, -count);
    const newFenHistory = fenHistory.slice(0, -count);
    const undoneMoves   = moves.slice(-count);
    const undoneFens    = fenHistory.slice(-count);

    // Prepend en orden cronológico → futureMoves[0] = primera a rehacer
    setFutureMoves(prev      => [...undoneMoves, ...prev]);
    setFutureFenHistory(prev => [...undoneFens,  ...prev]);

    const newFen = newFenHistory[newFenHistory.length - 1];
    setMoves(newMoves);
    setFenHistory(newFenHistory);
    setFen(newFen);
    setEvaluation({ score: 0, mateIn: null });
    setLastPlayerMove(null);
    setLastBotMove(null);
    setCommentary(null);
    _resetUI();
  }, [moves, fenHistory, gameStatus.isThinking, analysisMode, _resetUI]);

  /**
   * handleRedo — rehace jugadas previamente deshechas.
   */
  const handleRedo = useCallback(() => {
    if (futureMoves.length === 0 || gameStatus.isThinking) return;

    const count = (!analysisMode && futureMoves.length >= 2) ? 2 : 1;

    const redoMoves = futureMoves.slice(0, count);
    const redoFens  = futureFenHistory.slice(0, count);

    setMoves(prev      => [...prev, ...redoMoves]);
    setFenHistory(prev => [...prev, ...redoFens]);
    setFutureMoves(prev      => prev.slice(count));
    setFutureFenHistory(prev => prev.slice(count));

    const newFen = redoFens[redoFens.length - 1];
    setFen(newFen);
    setEvaluation({ score: 0, mateIn: null });
    setLastPlayerMove(null);
    _resetUI();
  }, [futureMoves, futureFenHistory, gameStatus.isThinking, analysisMode, _resetUI]);

  /** handleUndoAll — vuelve al inicio (posición inicial). */
  const handleUndoAll = useCallback(() => {
    if (moves.length === 0 || gameStatus.isThinking) return;

    setFutureMoves(prev      => [...moves,                 ...prev]);
    setFutureFenHistory(prev => [...fenHistory.slice(1),   ...prev]);

    const startFen = fenHistory[0];
    setMoves([]);
    setFenHistory([startFen]);
    setFen(startFen);
    setEvaluation({ score: 0, mateIn: null });
    _resetUI();
  }, [moves, fenHistory, gameStatus.isThinking, _resetUI]);

  /** handleRedoAll — avanza al final (última posición jugada). */
  const handleRedoAll = useCallback(() => {
    if (futureMoves.length === 0 || gameStatus.isThinking) return;

    setMoves(prev      => [...prev, ...futureMoves]);
    setFenHistory(prev => [...prev, ...futureFenHistory]);

    const lastFen = futureFenHistory[futureFenHistory.length - 1];
    setFutureMoves([]);
    setFutureFenHistory([]);
    setFen(lastFen);
    setEvaluation({ score: 0, mateIn: null });
    _resetUI();
  }, [futureMoves, futureFenHistory, gameStatus.isThinking, _resetUI]);

  // ── Teclado: Ctrl+Z / Ctrl+Y (o ← → sin Ctrl) ──────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z") { e.preventDefault(); handleUndo(); }
      if (ctrl && (e.key === "y" || e.key === "Z")) { e.preventDefault(); handleRedo(); }
      if (!ctrl && e.key === "ArrowLeft")  { e.preventDefault(); handleUndo(); }
      if (!ctrl && e.key === "ArrowRight") { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  // ── Derivados ────────────────────────────────────────────────────────────────
  // Prioridad: pista explícita > hover sobre sugerencia > jugada perdida del análisis
  const activeHint   = hintMove ?? highlightMove ?? missedMoveHighlight;
  const lastMoveSan  = moves.length > 0 ? moves[moves.length - 1].san : null;
  const activeColor  = gameStatus.turn === "w" ? "white" : "black";
  const canUndo      = moves.length > 0 && !gameStatus.isThinking;
  const canRedo      = futureMoves.length > 0 && !gameStatus.isThinking;


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

        {/* COLUMNA 2: Tablero + controles deshacer/rehacer + sugerencias */}
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
            analysisMode={analysisMode}
            opponentSquares={opponentSquares}
          />

          {/*
            Controles de deshacer / rehacer — como chess.com / Word.
            ⏮ = deshacer todo · ◀ = deshacer 1 paso · ▶ = rehacer · ⏭ = rehacer todo
            También responde a ← → y Ctrl+Z / Ctrl+Y.
          */}
          {(moves.length > 0 || futureMoves.length > 0) && (
            <div className="nav-arrows">
              <button
                className="nav-btn"
                onClick={handleUndoAll}
                disabled={!canUndo}
                title="Deshacer todo — volver al inicio"
              >⏮</button>

              <button
                className="nav-btn"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Deshacer jugada (← · Ctrl+Z)"
              >◀</button>

              <span className={`nav-badge ${futureMoves.length > 0 ? "nav-badge-future" : "nav-badge-live"}`}>
                {futureMoves.length > 0
                  ? `+${futureMoves.length} por rehacer`
                  : "● En vivo"
                }
              </span>

              <button
                className="nav-btn"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Rehacer jugada (→ · Ctrl+Y)"
              >▶</button>

              <button
                className="nav-btn"
                onClick={handleRedoAll}
                disabled={!canRedo}
                title="Rehacer todo — ir al final"
              >⏭</button>
            </div>
          )}

          {/* Sugerencias de Stockfish */}
          <MoveSuggestions
            fen={fen}
            playerColor={playerColor}
            gameStatus={gameStatus}
            onHighlight={setHighlightMove}
            onOpponentSquares={setOpponentSquares}
            onWrongMove={handleWrongMove}
            lastPlayerMove={lastPlayerMove}
            analysisMode={analysisMode}
          />
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
            analysisMode={analysisMode}
            onToggleAnalysis={handleToggleAnalysis}
            gameStatus={gameStatus}
            hintMove={hintMove}
            lastMoveSan={lastMoveSan}
            clockMinutes={clockMinutes}
            onClockChange={handleClockChange}
            gmCommentaryEnabled={gmCommentaryEnabled}
            onToggleGmCommentary={() => {
              setGmCommentaryEnabled(p => !p);
              if (gmCommentaryEnabled) setCommentary(null);
            }}
          />

          {/* Comentario de Gran Maestro — explica la jugada del jugador Y la del rival */}
          <MoveCommentary
            commentary={commentary}
            playerColor={playerColor}
            onClose={() => setCommentary(null)}
          />

          {/*
            Tarjeta de análisis de la última jugada del jugador.
            Aparece cuando el jugador hizo una jugada subóptima.
            Muestra razonamiento posicional y resalta en el tablero
            las casillas de la jugada que Stockfish prefería.
          */}
          <MoveAnalysisCard
            info={wrongMoveInfo}
            onClose={() => { setWrongMoveInfo(null); setMissedMoveHighlight(null); }}
            onHighlight={(h) => {
              // Al hacer hover en la tarjeta, resaltar en el tablero
              // Solo si no hay pista activa ni sugerencia en hover
              if (!hintMove && !highlightMove) setMissedMoveHighlight(h);
            }}
          />

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
