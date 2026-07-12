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

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import Board           from "./components/Board";
import GameReview      from "./components/GameReview";
import LearnSection    from "./components/LearnSection";
import NotationGlossary from "./components/NotationGlossary";
import ErrorBoundary     from "./components/ErrorBoundary";
import { detectOpening } from "./data/openings";
import { formatSan }     from "./utils/notation";
import ControlPanel    from "./components/ControlPanel";
import AdvantageBar    from "./components/AdvantageBar";
import MoveHistory     from "./components/MoveHistory";
import MoveSuggestions   from "./components/MoveSuggestions";
import MoveAnalysisCard  from "./components/MoveAnalysisCard";
import MoveCommentary    from "./components/MoveCommentary";
import ChessClock        from "./components/ChessClock";
import { checkHealth, getHint, getCommentary, saveGame } from "./api/chess";
import "./App.css";
import "./views.css";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function App() {

  // ── Vista activa: jugar | analizar | aprender ────────────────────────────────
  const [view, setView] = useState("jugar");

  // ── Pestaña activa del panel derecho (vista Jugar): sugerencias | jugadas | ajustes ──
  const [rightTab, setRightTab] = useState("sugerencias");

  // ── Notación española (C=Caballo, A=Alfil...) y glosario ────────────────────
  // Persiste en localStorage para no tener que reactivarla en cada sesión.
  const [esNotation, setEsNotation] = useState(
    () => localStorage.getItem("esNotation") === "1"
  );
  const [glossaryOpen, setGlossaryOpen] = useState(false);
  const toggleNotation = useCallback(() => {
    setEsNotation(prev => {
      localStorage.setItem("esNotation", prev ? "0" : "1");
      return !prev;
    });
  }, []);

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
    boardTheme:       "classic",
  });

  // ── Modo análisis libre ───────────────────────────────────────────────────────
  const [analysisMode, setAnalysisMode] = useState(false);

  // ── Reloj ────────────────────────────────────────────────────────────────────
  const [clockMinutes, setClockMinutes] = useState(0);
  const [whiteTime, setWhiteTime]       = useState(null);
  const [blackTime, setBlackTime]       = useState(null);
  // timeoutLoss = color que perdió por tiempo ("white" | "black" | null).
  // Es DERIVADO del reloj: si un tiempo llegó a 0, ese color perdió. Al empezar
  // una partida nueva los relojes se recargan (> 0) y esto vuelve a null solo.
  const timeoutLoss = whiteTime === 0 ? "white" : blackTime === 0 ? "black" : null;

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
  const [gmCommentaryEnabled, setGmCommentaryEnabled] = useState(false);
  // Ref para acceder a lastPlayerMove dentro de efectos async sin stale closure
  const lastPlayerMoveRef = useRef(null);

  // ── Estado efectivo de la partida ────────────────────────────────────────────
  // Board reporta gameStatus solo con lo que sabe chess.js (mate, tablas...).
  // Si alguien perdió por tiempo, aquí se fusiona: gameOver forzado + resultado.
  // TODO el resto de la app debe usar effectiveStatus, no gameStatus.
  const effectiveStatus = useMemo(() => {
    // Si la partida ya terminó por mate/tablas, ese resultado manda
    if (!timeoutLoss || gameStatus.gameOver) return gameStatus;
    return {
      ...gameStatus,
      gameOver:   true,
      isThinking: false,
      timeout:    true,
      result:     timeoutLoss === "white" ? "0-1" : "1-0",
    };
  }, [gameStatus, timeoutLoss]);

  // ── Refs para el reloj ───────────────────────────────────────────────────────
  const gameStatusRef = useRef(effectiveStatus);
  useEffect(() => { gameStatusRef.current = effectiveStatus; }, [effectiveStatus]);

  // ── Guardado automático en el historial al terminar la partida ──────────────
  // savedGameNotice = { id } mientras se muestra la tarjeta "Partida guardada".
  const [savedGameNotice, setSavedGameNotice] = useState(null);
  // Ref para detectar la TRANSICIÓN false → true de gameStatus.gameOver
  // (no queremos volver a guardar si el componente re-renderiza con gameOver aún true).
  const wasGameOverRef = useRef(false);

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

  // ── useEffect: guardar la partida en el historial cuando termina ────────────
  // Solo en la transición false → true de gameOver, y nunca en modo análisis
  // libre (ahí no hay "jugador vs. bot" que valga la pena archivar).
  useEffect(() => {
    const isOver = !!effectiveStatus.gameOver;
    if (isOver && !wasGameOverRef.current && !analysisMode && moves.length > 0) {
      const movesSan = moves.map(m => m.san);
      saveGame({
        player_color: playerColor,
        skill_level:  skillLevel,
        result:       effectiveStatus.result ?? "*",
        moves_san:    movesSan,
      })
        .then(res => setSavedGameNotice({ id: res.data.id }))
        .catch(err => console.error("No se pudo guardar la partida en el historial:", err));
    }
    wasGameOverRef.current = isOver;
  }, [effectiveStatus.gameOver, effectiveStatus.result, analysisMode, moves, playerColor, skillLevel]);

  /**
   * handleWrongMove — recibe el análisis de la jugada subóptima desde MoveSuggestions.
   * Solo actualiza la tarjeta de análisis. La flecha naranja en el tablero NO se
   * pinta automáticamente: aparece únicamente cuando el usuario pasa el cursor
   * sobre "Stockfish prefería" en la tarjeta (via onHighlight de MoveAnalysisCard).
   */
  const handleWrongMove = useCallback((info) => {
    setWrongMoveInfo(info);
    // SIEMPRE limpiar la flecha naranja cuando cambia el análisis: si quedara
    // una de un hover anterior (o de una tarjeta previa), sería una flecha
    // "fantasma" apuntando a una jugada que ya no corresponde.
    setMissedMoveHighlight(null);
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
    setSavedGameNotice(null);
    wasGameOverRef.current = false;
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
      setSavedGameNotice(null);
      wasGameOverRef.current = false;
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
    if (effectiveStatus.gameOver || effectiveStatus.isThinking) return;
    try {
      const res = await getHint(fen);
      setHintMove(res.data);
    } catch (err) {
      console.error("Error al obtener pista:", err);
    }
  }, [fen, effectiveStatus]);

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
      if (view !== "jugar") return; // en Analizar/Aprender navegan sus propias vistas
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z") { e.preventDefault(); handleUndo(); }
      if (ctrl && (e.key === "y" || e.key === "Z")) { e.preventDefault(); handleRedo(); }
      if (!ctrl && e.key === "ArrowLeft")  { e.preventDefault(); handleUndo(); }
      if (!ctrl && e.key === "ArrowRight") { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo, view]);

  // ── Derivados ────────────────────────────────────────────────────────────────
  // Prioridad: pista explícita > hover sobre sugerencia > jugada perdida del análisis
  const activeHint   = hintMove ?? highlightMove ?? missedMoveHighlight;

  // ── Flechas del tablero (estilo chess.com) ────────────────────────────────
  // Las flechas solo aparecen cuando el jugador las pide explícitamente:
  // Verde = hover sobre una sugerencia del panel · Azul = pista pedida
  // · Naranja = jugada que debiste hacer (tras un error).
  // (No se pinta ninguna flecha "permanente" — así el tablero queda limpio
  // y puedes pensar tu jugada sin spoilers.)
  const boardArrows = useMemo(() => {
    const list = [];
    if (missedMoveHighlight && !hintMove && !highlightMove) {
      list.push({ from: missedMoveHighlight.from_square, to: missedMoveHighlight.to_square, color: "#e58f2a", opacity: 0.85 });
    }
    if (highlightMove) {
      list.push({ from: highlightMove.from_square, to: highlightMove.to_square, color: "#81b64c", opacity: 0.9 });
    }
    if (hintMove) {
      list.push({ from: hintMove.from_square, to: hintMove.to_square, color: "#60a5fa", opacity: 0.95 });
    }
    return list;
  }, [highlightMove, hintMove, missedMoveHighlight]);

  // Apertura detectada en vivo — coincide el prefijo más largo de la base ECO.
  // Se refina mientras juegas: "Peón de rey" → "Italiana" → "Giuoco Piano".
  const currentOpening = useMemo(
    () => detectOpening(moves.map(m => m.san)),
    [moves]
  );
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

        {/* Navegación principal: jugar / analizar partidas / aprender */}
        <nav className="main-nav">
          <button
            className={`nav-tab ${view === "jugar" ? "active" : ""}`}
            onClick={() => setView("jugar")}
          >🎮 Jugar</button>
          <button
            className={`nav-tab ${view === "analizar" ? "active" : ""}`}
            onClick={() => setView("analizar")}
          >🔍 Analizar partida</button>
          <button
            className={`nav-tab ${view === "aprender" ? "active" : ""}`}
            onClick={() => setView("aprender")}
          >📚 Aprender</button>
        </nav>

        <div className="header-right">
          {/* Toggle notación: EN (Nf3) ↔ ES (Cf3) */}
          <button
            className={`notation-toggle ${esNotation ? "active" : ""}`}
            onClick={toggleNotation}
            title={esNotation
              ? "Notación española activa (C=Caballo, A=Alfil). Clic para inglés."
              : "Notación inglesa activa (N=Knight, B=Bishop). Clic para español."}
          >
            ♞ {esNotation ? "ES · Cf3" : "EN · Nf3"}
          </button>
          <button
            className="notation-toggle"
            onClick={() => setGlossaryOpen(true)}
            title="Glosario de notación: qué significa cada letra y símbolo"
          >❓ Notación</button>
          <div className="header-sub">Stockfish · Nivel {skillLevel}/20</div>
        </div>
      </header>

      <NotationGlossary
        open={glossaryOpen}
        onClose={() => setGlossaryOpen(false)}
        spanish={esNotation}
      />

      {/* Las tres vistas permanecen montadas para no perder el análisis en
          curso ni la partida al cambiar de pestaña. Se ocultan con la clase
          .view-hidden (fuera de pantalla) y NO con display:none: react-chessboard
          mide el ancho de las casillas al animar piezas y con display:none el
          ancho es 0 → lanza "Square width not found". Fuera de pantalla el
          tablero conserva su tamaño real y las animaciones nunca fallan. */}
      <main className={`app-page ${view === "analizar" ? "" : "view-hidden"}`}>
        <ErrorBoundary>
          <GameReview active={view === "analizar"} esNotation={esNotation} />
        </ErrorBoundary>
      </main>
      <main className={`app-page ${view === "aprender" ? "" : "view-hidden"}`}>
        <ErrorBoundary>
          <LearnSection active={view === "aprender"} esNotation={esNotation} />
        </ErrorBoundary>
      </main>

      <main className={`app-layout ${view === "jugar" ? "" : "view-hidden"}`}>
       <ErrorBoundary>

        {/* COLUMNA 1: Barra de ventaja */}
        <AdvantageBar
          score={evaluation.score}
          mateIn={evaluation.mateIn}
          height={640}
        />

        {/* COLUMNA 2: Tablero + controles deshacer/rehacer + sugerencias */}
        <div className="board-col">

          {/* Aviso no intrusivo: la partida terminada se guardó en el historial */}
          {savedGameNotice && (
            <div className="suggestion-card saved-game-banner">
              <span>💾 Partida guardada — revísala en Analizar → 📁 Mis partidas</span>
              <div className="saved-game-banner-actions">
                <button
                  className="btn btn-outline"
                  onClick={() => { setView("analizar"); setSavedGameNotice(null); }}
                >Ver historial</button>
                <button
                  className="btn btn-outline"
                  onClick={() => setSavedGameNotice(null)}
                  title="Cerrar aviso"
                >✕</button>
              </div>
            </div>
          )}

          {/* Detector de apertura en vivo — para ir memorizándolas al jugar */}
          {currentOpening && (
            <div className="opening-badge" title={`Línea: ${currentOpening.moves}`}>
              📖 Estás jugando: <b>{currentOpening.name}</b>
              <span className="opening-eco">{currentOpening.eco}</span>
            </div>
          )}

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
            arrows={boardArrows}
            frozen={!!timeoutLoss}
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
        </div>

        {/* COLUMNA 3: Reloj + panel con pestañas (Sugerencias / Jugadas / Ajustes) */}
        <div className="right-col">

          <ChessClock
            whiteTime={whiteTime}
            blackTime={blackTime}
            activeColor={activeColor}
            gameOver={effectiveStatus.gameOver}
            timeoutLoser={timeoutLoss}
          />

          {/*
            Panel derecho con pestañas internas — dirección "1a Verde chess.com".
            Los tres componentes permanecen siempre montados (solo se ocultan
            con CSS) para no perder su estado ni interrumpir sus efectos
            (p. ej. MoveSuggestions sigue pidiendo sugerencias en segundo plano).
          */}
          <div className="right-tabs-panel">
            <div className="right-tabs-bar">
              <button
                className={`right-tab ${rightTab === "sugerencias" ? "active" : ""}`}
                onClick={() => setRightTab("sugerencias")}
              >💡 Sugerencias</button>
              <button
                className={`right-tab ${rightTab === "jugadas" ? "active" : ""}`}
                onClick={() => setRightTab("jugadas")}
              >📜 Jugadas</button>
              <button
                className={`right-tab ${rightTab === "ajustes" ? "active" : ""}`}
                onClick={() => setRightTab("ajustes")}
              >⚙ Ajustes</button>
            </div>

            <div className="right-tab-content">
              <div className={rightTab === "sugerencias" ? "" : "tab-hidden"}>
                <MoveSuggestions
                  fen={fen}
                  playerColor={playerColor}
                  gameStatus={effectiveStatus}
                  onHighlight={setHighlightMove}
                  onOpponentSquares={setOpponentSquares}
                  onWrongMove={handleWrongMove}
                  lastPlayerMove={lastPlayerMove}
                  analysisMode={analysisMode}
                  esNotation={esNotation}
                />
              </div>

              <div className={rightTab === "jugadas" ? "" : "tab-hidden"}>
                <MoveHistory
                  moves={moves}
                  fenHistory={fenHistory}
                  esNotation={esNotation}
                />
              </div>

              <div className={rightTab === "ajustes" ? "" : "tab-hidden"}>
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
                  gameStatus={effectiveStatus}
                  hintMove={hintMove}
                  lastMoveSan={lastMoveSan ? formatSan(lastMoveSan, esNotation) : lastMoveSan}
                  clockMinutes={clockMinutes}
                  onClockChange={handleClockChange}
                  gmCommentaryEnabled={gmCommentaryEnabled}
                  onToggleGmCommentary={() => {
                    setGmCommentaryEnabled(p => !p);
                    if (gmCommentaryEnabled) setCommentary(null);
                  }}
                />
              </div>
            </div>
          </div>

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
            esNotation={esNotation}
            info={wrongMoveInfo}
            onClose={() => { setWrongMoveInfo(null); setMissedMoveHighlight(null); }}
            // Hover en "Stockfish prefería" → flecha naranja; al salir → se borra.
            // SIN condiciones: si se condiciona la limpieza (p. ej. a que no haya
            // otra sugerencia en hover), el evento de salida se pierde y la
            // flecha queda pegada en el tablero sin hover activo.
            onHighlight={setMissedMoveHighlight}
          />

        </div>

       </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;
