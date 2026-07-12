/**
 * GameReview.jsx — Revisión de partida estilo chess.com.
 *
 * Flujo:
 *   1. Importar: usuario de chess.com (lista sus partidas) o pegar un PGN
 *   2. Analizar: recorre la partida ply a ply llamando a /api/analyze-move
 *      con barra de progreso real y opción de cancelar
 *   3. Revisar: resumen de precisión + gráfica de evaluación + tablero con
 *      flechas + lista de jugadas clasificadas + explicación de cada error
 *
 * ¿Por qué el análisis va en el frontend jugada a jugada?
 * Cada request devuelve el eval_after que se pasa como eval_before del
 * siguiente ply (ahorra la mitad del trabajo del motor) y la barra de
 * progreso refleja el avance real, con posibilidad de cancelar.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { analyzeMove, getChesscomArchives, getChesscomGames, listGames, getGame, deleteGame } from "../api/chess";
import { detectOpening } from "../data/openings";
import { formatSan, translateSanInText } from "../utils/notation";
import EvalGraph from "./EvalGraph";
import { ArrowLayer } from "../utils/arrows";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// Colores e íconos por clasificación — mismos códigos que usa chess.com
const CLASS_STYLE = {
  brilliant:  { color: "#26c2a3", bg: "rgba(38,194,163,.12)" },
  best:       { color: "#81b64c", bg: "rgba(129,182,76,.12)" },
  excellent:  { color: "#81b64c", bg: "rgba(129,182,76,.10)" },
  good:       { color: "#95b776", bg: "rgba(149,183,118,.10)" },
  forced:     { color: "#97af8b", bg: "rgba(151,175,139,.10)" },
  inaccuracy: { color: "#f0c15c", bg: "rgba(240,193,92,.12)" },
  mistake:    { color: "#e58f2a", bg: "rgba(229,143,42,.12)" },
  miss:       { color: "#e02828", bg: "rgba(224,40,40,.12)" },
  blunder:    { color: "#ca3431", bg: "rgba(202,52,49,.14)" },
};

const MONTH_NAMES = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Parsea un PGN con chess.js y devuelve la lista de plies con FEN antes/después. */
function parsePgn(pgn) {
  const chess = new Chess();
  chess.loadPgn(pgn); // lanza si el PGN es inválido
  const headers = typeof chess.getHeaders === "function" ? chess.getHeaders() : {};
  const verbose = chess.history({ verbose: true });
  if (verbose.length === 0) throw new Error("El PGN no contiene jugadas");

  const plies = verbose.map((m) => ({
    san: m.san,
    uci: m.from + m.to + (m.promotion || ""),
    color: m.color === "w" ? "white" : "black",
    fenBefore: m.before,
    fenAfter: m.after,
  }));
  return { plies, headers };
}

/**
 * buildGameFromSanMoves — reconstruye el mismo objeto { plies, headers } que
 * parsePgn(), pero a partir de una lista de jugadas SAN (como las guarda el
 * historial local en SQLite) en vez de un texto PGN completo.
 *
 * Reutiliza chess.js jugando cada SAN en orden para obtener from/to/fenBefore/
 * fenAfter — así el resto del componente (análisis, tablero, flechas) no
 * necesita saber si la partida vino de un PGN pegado o del historial propio.
 */
function buildGameFromSanMoves(movesSan, headers = {}) {
  const chess = new Chess();
  if (!movesSan || movesSan.length === 0) throw new Error("La partida no tiene jugadas");
  const plies = movesSan.map((san) => {
    const before = chess.fen();
    const m = chess.move(san); // lanza si el SAN es inválido en esta posición
    return {
      san: m.san,
      uci: m.from + m.to + (m.promotion || ""),
      color: m.color === "w" ? "white" : "black",
      fenBefore: before,
      fenAfter: chess.fen(),
    };
  });
  return { plies, headers };
}

export default function GameReview({ active = true, esNotation = false }) {
  // ── Importación ──────────────────────────────────────────────────────────
  const [importTab, setImportTab] = useState("chesscom"); // chesscom | pgn | historial
  const [username, setUsername]   = useState("");
  const [months, setMonths]       = useState([]);
  const [monthIdx, setMonthIdx]   = useState(0);
  const [gamesList, setGamesList] = useState([]);
  const [importError, setImportError] = useState(null);
  const [loadingGames, setLoadingGames] = useState(false);
  const [pgnText, setPgnText]     = useState("");

  // ── Historial local ("Mis partidas") ─────────────────────────────────────
  const [savedGames, setSavedGames]           = useState([]);
  const [loadingSavedGames, setLoadingSavedGames] = useState(false);
  const [savedGamesError, setSavedGamesError] = useState(null);

  // ── Partida cargada y análisis ───────────────────────────────────────────
  const [game, setGame]           = useState(null);   // { plies, headers }
  const [analysis, setAnalysis]   = useState([]);     // resultados por ply
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [depth, setDepth]         = useState(14);
  const cancelRef = useRef(false);

  // ── Navegación por la partida ────────────────────────────────────────────
  const [ply, setPly] = useState(-1); // -1 = posición inicial

  // ── Orientación del tablero ──────────────────────────────────────────────
  // Al importar desde chess.com se detecta automáticamente con qué color
  // jugaste (comparando tu usuario) y el tablero se orienta desde tu lado.
  // El botón 🔄 permite voltearlo en cualquier momento.
  const [orientation, setOrientation] = useState("white");

  // ── Importar desde chess.com ─────────────────────────────────────────────
  const loadArchives = useCallback(async () => {
    if (!username.trim()) return;
    setImportError(null); setLoadingGames(true); setGamesList([]);
    try {
      const res = await getChesscomArchives(username.trim());
      const m = res.data.months;
      if (m.length === 0) throw new Error("Este usuario no tiene partidas");
      setMonths(m); setMonthIdx(0);
      const g = await getChesscomGames(username.trim(), m[0].year, m[0].month);
      setGamesList(g.data.games);
    } catch (err) {
      setImportError(err?.response?.data?.detail ?? err.message);
    } finally {
      setLoadingGames(false);
    }
  }, [username]);

  const loadMonth = useCallback(async (idx) => {
    setMonthIdx(idx); setLoadingGames(true); setImportError(null);
    try {
      const m = months[idx];
      const g = await getChesscomGames(username.trim(), m.year, m.month);
      setGamesList(g.data.games);
    } catch (err) {
      setImportError(err?.response?.data?.detail ?? err.message);
      setGamesList([]);
    } finally {
      setLoadingGames(false);
    }
  }, [months, username]);

  // ── Historial local ("Mis partidas") ─────────────────────────────────────
  const refreshSavedGames = useCallback(async () => {
    setLoadingSavedGames(true); setSavedGamesError(null);
    try {
      const res = await listGames();
      setSavedGames(res.data.games);
    } catch (err) {
      setSavedGamesError(err?.response?.data?.detail ?? err.message);
    } finally {
      setLoadingSavedGames(false);
    }
  }, []);

  // Cargar la lista automáticamente al abrir la pestaña (una sola vez por apertura)
  useEffect(() => {
    if (importTab === "historial" && !game) {
      refreshSavedGames();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importTab]);

  const loadSavedGame = useCallback(async (id) => {
    setImportError(null);
    try {
      const res = await getGame(id);
      const data = res.data;
      const parsed = buildGameFromSanMoves(data.moves_san, {
        White: data.player_color === "white" ? "Tú" : data.opponent_label,
        Black: data.player_color === "black" ? "Tú" : data.opponent_label,
        Result: data.result,
      });
      setGame(parsed);
      setAnalysis([]);
      setPly(-1);
      setOrientation(data.player_color === "black" ? "black" : "white");
    } catch (err) {
      setImportError(`No se pudo cargar la partida: ${err?.response?.data?.detail ?? err.message}`);
    }
  }, []);

  const removeSavedGame = useCallback(async (id, e) => {
    e.stopPropagation();
    try {
      await deleteGame(id);
      setSavedGames(prev => prev.filter(g => g.id !== id));
    } catch (err) {
      setSavedGamesError(err?.response?.data?.detail ?? err.message);
    }
  }, []);

  // ── Cargar una partida (desde lista o PGN pegado) ───────────────────────
  // sideHint: "white" | "black" — con qué color jugó el usuario (se detecta
  // al importar de chess.com); orienta el tablero desde SU lado.
  const loadGame = useCallback((pgn, sideHint = null) => {
    setImportError(null);
    try {
      const parsed = parsePgn(pgn);
      setGame(parsed);
      setAnalysis([]);
      setPly(-1);
      if (sideHint) {
        setOrientation(sideHint);
      } else {
        // PGN pegado: si el nombre de usuario buscado coincide con Black, voltear
        const h = parsed.headers ?? {};
        const user = username.trim().toLowerCase();
        setOrientation(
          user && h.Black?.toLowerCase() === user ? "black" : "white"
        );
      }
    } catch (err) {
      setImportError(`PGN inválido: ${err.message}`);
    }
  }, [username]);

  // ── Análisis jugada a jugada ─────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (!game || analyzing) return;
    setAnalyzing(true); setProgress(0); setAnalysis([]); setPly(-1);
    cancelRef.current = false;

    const results = [];
    let prevEvalAfter = null; // eval_after del ply anterior = eval_before de este

    for (let i = 0; i < game.plies.length; i++) {
      if (cancelRef.current) break;
      const p = game.plies[i];
      try {
        const res = await analyzeMove(p.fenBefore, p.uci, prevEvalAfter, depth);
        results.push(res.data);
        prevEvalAfter = res.data.eval_after;
      } catch (err) {
        console.error("Error analizando ply", i, err);
        setImportError(`Error del motor en la jugada ${Math.floor(i / 2) + 1}: `
          + (err?.response?.data?.detail ?? err.message));
        break;
      }
      setAnalysis([...results]);
      setProgress(Math.round(((i + 1) / game.plies.length) * 100));
    }

    setAnalyzing(false);
    if (results.length > 0) setPly(0);
  }, [game, analyzing, depth]);

  const cancelAnalysis = useCallback(() => { cancelRef.current = true; }, []);

  // ── Resumen: precisión media y conteo por clasificación ──────────────────
  const summary = useMemo(() => {
    if (analysis.length === 0) return null;
    const acc = { white: [], black: [] };
    const counts = { white: {}, black: {} };
    analysis.forEach(m => {
      acc[m.color].push(m.accuracy);
      const k = m.classification.key;
      counts[m.color][k] = (counts[m.color][k] || 0) + 1;
    });
    const avg = arr => arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return {
      white: { accuracy: avg(acc.white).toFixed(1), counts: counts.white },
      black: { accuracy: avg(acc.black).toFixed(1), counts: counts.black },
    };
  }, [analysis]);

  // Apertura detectada en la partida importada
  const opening = useMemo(() => {
    if (!game) return null;
    return detectOpening(game.plies.map(p => p.san));
  }, [game]);

  // ── Posición y resaltados actuales ───────────────────────────────────────
  const currentFen = ply < 0 ? START_FEN
    : (game?.plies[ply]?.fenAfter ?? START_FEN);
  const currentAnalysis = ply >= 0 ? analysis[ply] : null;

  const squareStyles = useMemo(() => {
    const styles = {};
    if (ply >= 0 && game) {
      const p = game.plies[ply];
      const from = p.uci.slice(0, 2), to = p.uci.slice(2, 4);
      const key = currentAnalysis?.classification?.key;
      const color = CLASS_STYLE[key]?.color ?? "#f7e26b";
      styles[from] = { backgroundColor: `${color}55` };
      styles[to]   = { backgroundColor: `${color}88` };
    }
    return styles;
  }, [ply, game, currentAnalysis]);

  // ── Flechas: jugada realizada (color según clasificación) + mejor
  // alternativa en verde, igual que el diseño de referencia (1d Analizar). ──
  const reviewArrows = useMemo(() => {
    if (ply < 0 || !game) return [];
    const arrows = [];
    const p = game.plies[ply];
    const from = p.uci.slice(0, 2), to = p.uci.slice(2, 4);
    const key = currentAnalysis?.classification?.key;
    const color = CLASS_STYLE[key]?.color ?? "#f7e26b";
    arrows.push({ from, to, color, opacity: 0.85 });
    // Mejor jugada alternativa (si la jugada hecha no fue la mejor)
    if (currentAnalysis && !["best", "brilliant", "forced"].includes(key)) {
      const bFrom = currentAnalysis.best_move_uci.slice(0, 2);
      const bTo   = currentAnalysis.best_move_uci.slice(2, 4);
      if (bFrom !== from || bTo !== to) {
        arrows.push({ from: bFrom, to: bTo, color: "#81b64c", opacity: 0.8 });
      }
    }
    return arrows;
  }, [ply, game, currentAnalysis]);

  // ── Teclado ← → para navegar (solo con la pestaña visible) ───────────────
  useEffect(() => {
    if (!game || !active) return;
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft")  { e.preventDefault(); setPly(p => Math.max(-1, p - 1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setPly(p => Math.min(game.plies.length - 1, p + 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, active]);

  const fmtEval = (m) => {
    if (m.mate_after != null) return `M${Math.abs(m.mate_after)}`;
    const v = m.eval_after / 100;
    return (v > 0 ? "+" : "") + v.toFixed(1);
  };

  // ══════════════════════ RENDER ══════════════════════

  // ── Pantalla de importación ──────────────────────────────────────────────
  if (!game) {
    return (
      <div className="review-import">
        <h2>🔍 Analizar una partida</h2>
        <p className="review-sub">
          Importa una partida de chess.com o pega un PGN y recibe un análisis
          jugada a jugada con Stockfish: errores, mejores opciones y explicación.
        </p>

        <div className="import-tabs">
          <button
            className={`import-tab ${importTab === "chesscom" ? "active" : ""}`}
            onClick={() => setImportTab("chesscom")}
          >♟ Desde chess.com</button>
          <button
            className={`import-tab ${importTab === "pgn" ? "active" : ""}`}
            onClick={() => setImportTab("pgn")}
          >📋 Pegar PGN</button>
          <button
            className={`import-tab ${importTab === "historial" ? "active" : ""}`}
            onClick={() => setImportTab("historial")}
          >📁 Mis partidas</button>
        </div>

        {importTab === "chesscom" && (
          <div className="import-panel">
            <div className="import-row">
              <input
                type="text"
                placeholder="Tu usuario de chess.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadArchives()}
              />
              <button className="btn btn-newgame" onClick={loadArchives} disabled={loadingGames}>
                {loadingGames ? "Buscando..." : "Buscar partidas"}
              </button>
            </div>

            {months.length > 0 && (
              <select
                className="month-select"
                value={monthIdx}
                onChange={(e) => loadMonth(Number(e.target.value))}
              >
                {months.map((m, i) => (
                  <option key={`${m.year}-${m.month}`} value={i}>
                    {MONTH_NAMES[m.month]} {m.year}
                  </option>
                ))}
              </select>
            )}

            {gamesList.length > 0 && (
              <div className="games-list">
                {gamesList.map((g, i) => {
                  const isUserWhite = g.white.username.toLowerCase() === username.trim().toLowerCase();
                  const me    = isUserWhite ? g.white : g.black;
                  const rival = isUserWhite ? g.black : g.white;
                  const won  = me.result === "win";
                  const draw = ["agreed", "repetition", "stalemate", "insufficient",
                                "50move", "timevsinsufficient"].includes(me.result);
                  return (
                    <button
                      key={i}
                      className="game-item"
                      onClick={() => loadGame(g.pgn, isUserWhite ? "white" : "black")}
                    >
                      <span className={`game-result ${won ? "win" : draw ? "draw" : "loss"}`}>
                        {won ? "G" : draw ? "T" : "P"}
                      </span>
                      <span className="game-players">
                        <b>{me.username}</b> ({me.rating}) vs {rival.username} ({rival.rating})
                      </span>
                      <span className="game-meta">
                        {isUserWhite ? "♔ blancas" : "♚ negras"} · {g.time_class} ·{" "}
                        {new Date(g.end_time * 1000).toLocaleDateString()}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {importTab === "pgn" && (
          <div className="import-panel">
            <textarea
              className="pgn-input"
              rows={10}
              placeholder={'Pega aquí el PGN de tu partida...\n\n[Event "Live Chess"]\n[White "jugador1"]\n[Black "jugador2"]\n\n1. e4 e5 2. Nf3 Nc6 ...'}
              value={pgnText}
              onChange={(e) => setPgnText(e.target.value)}
            />
            <button
              className="btn btn-newgame"
              onClick={() => loadGame(pgnText)}
              disabled={!pgnText.trim()}
            >Cargar partida</button>
          </div>
        )}

        {importTab === "historial" && (
          <div className="import-panel">
            <div className="import-row">
              <p className="review-sub" style={{ margin: 0 }}>
                Partidas jugadas contra el bot, guardadas automáticamente al terminar.
              </p>
              <button className="btn btn-outline" onClick={refreshSavedGames} disabled={loadingSavedGames}>
                {loadingSavedGames ? "Cargando..." : "🔄 Actualizar"}
              </button>
            </div>

            {savedGamesError && <div className="import-error">⚠ {savedGamesError}</div>}

            {!loadingSavedGames && savedGames.length === 0 && !savedGamesError && (
              <p className="review-sub">
                Todavía no tienes partidas guardadas. Juega una partida contra el bot en
                la pestaña 🎮 Jugar — se guardará sola al terminar.
              </p>
            )}

            {savedGames.length > 0 && (
              <div className="games-list">
                {savedGames.map((g) => {
                  const won = (g.player_color === "white" && g.result === "1-0")
                    || (g.player_color === "black" && g.result === "0-1");
                  const draw = g.result === "1/2-1/2";
                  const date = new Date(g.created_at).toLocaleString();
                  return (
                    <button
                      key={g.id}
                      className="game-item"
                      onClick={() => loadSavedGame(g.id)}
                    >
                      <span className={`game-result ${won ? "win" : draw ? "draw" : "loss"}`}>
                        {won ? "G" : draw ? "T" : "P"}
                      </span>
                      <span className="game-players">
                        <b>Tú</b> ({g.player_color === "white" ? "♔ blancas" : "♚ negras"}) vs {g.opponent_label}
                      </span>
                      <span className="game-meta">
                        {g.ply_count} jugadas · {date}
                        {g.white_accuracy != null && ` · Precisión blancas ${g.white_accuracy.toFixed(1)}`}
                        {g.black_accuracy != null && ` · Precisión negras ${g.black_accuracy.toFixed(1)}`}
                      </span>
                      <span
                        className="btn btn-outline"
                        role="button"
                        title="Borrar del historial"
                        onClick={(e) => removeSavedGame(g.id, e)}
                        style={{ marginLeft: "auto" }}
                      >🗑</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {importError && <div className="import-error">⚠ {importError}</div>}
      </div>
    );
  }

  // ── Pantalla de revisión ────────────────────────────────────────────────
  const h = game.headers ?? {};
  const title = `${h.White ?? "Blancas"} (${h.WhiteElo ?? "?"}) vs ${h.Black ?? "Negras"} (${h.BlackElo ?? "?"})`;

  return (
    <div className="review-layout">

      {/* Columna izquierda: tablero + gráfica */}
      <div className="review-board-col">
        <div className="review-title-row">
          <div>
            <div className="review-title">{title}</div>
            <div className="review-subtitle">
              {h.Result ?? ""} {opening && <>· 📖 {opening.name} ({opening.eco})</>}
            </div>
          </div>
          <button className="btn btn-outline" onClick={() => { setGame(null); setAnalysis([]); }}>
            ← Otra partida
          </button>
        </div>

        {/* Indicador de perspectiva: desde qué lado se ve el tablero */}
        <div className="orientation-bar">
          <span className="orientation-label">
            {orientation === "white" ? "♔ Viendo desde blancas" : "♚ Viendo desde negras"}
            {" · "}
            <b>{orientation === "white" ? (h.White ?? "Blancas") : (h.Black ?? "Negras")}</b> abajo
          </span>
          <button
            className="btn btn-outline"
            onClick={() => setOrientation(o => o === "white" ? "black" : "white")}
            title="Voltear el tablero"
          >🔄 Voltear tablero</button>
        </div>

        <div style={{ position: "relative" }}>
          <Chessboard
            options={{
              id: "board-review", // único: evita colisión de ids con otros tableros montados
              position: currentFen,
              boardOrientation: orientation,
              squareStyles,
              canDragPiece: () => false,
              animationDurationInMs: 150,
              showNotation: true,
            }}
          />
          <ArrowLayer arrows={reviewArrows} orientation={orientation} />
        </div>

        <div className="nav-arrows">
          <button className="nav-btn" onClick={() => setPly(-1)} disabled={ply < 0}>⏮</button>
          <button className="nav-btn" onClick={() => setPly(p => Math.max(-1, p - 1))} disabled={ply < 0}>◀</button>
          <span className="nav-badge nav-badge-live">
            {ply < 0 ? "Inicio" : `Jugada ${Math.floor(ply / 2) + 1}${ply % 2 === 0 ? "" : "..."} de ${Math.ceil(game.plies.length / 2)}`}
          </span>
          <button className="nav-btn" onClick={() => setPly(p => Math.min(game.plies.length - 1, p + 1))}
            disabled={ply >= game.plies.length - 1}>▶</button>
          <button className="nav-btn" onClick={() => setPly(game.plies.length - 1)}
            disabled={ply >= game.plies.length - 1}>⏭</button>
        </div>

        {analysis.length > 0 && (
          <EvalGraph analysis={analysis} currentPly={ply} onSelectPly={setPly} />
        )}
      </div>

      {/* Columna derecha: análisis */}
      <div className="review-side-col">

        {/* Lanzar análisis */}
        {analysis.length === 0 && !analyzing && (
          <div className="review-start-card">
            <h3>Análisis completo</h3>
            <p>Stockfish revisará cada jugada, clasificará los errores y te
              explicará qué había mejor — como el Game Review de chess.com.</p>
            <label className="depth-label">
              Profundidad: <b>{depth}</b>
              <input type="range" min="10" max="20" value={depth}
                onChange={(e) => setDepth(Number(e.target.value))} />
              <span className="depth-hint">{depth <= 12 ? "rápido" : depth <= 16 ? "equilibrado" : "profundo (lento)"}</span>
            </label>
            <button className="btn btn-newgame btn-analyze" onClick={runAnalysis}>
              ⚡ Analizar partida ({game.plies.length} jugadas)
            </button>
          </div>
        )}

        {/* Progreso */}
        {analyzing && (
          <div className="review-start-card">
            <h3>Analizando... {progress}%</h3>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="progress-hint">
              Jugada {analysis.length} de {game.plies.length} — puedes navegar
              las jugadas ya analizadas mientras termina.
            </p>
            <button className="btn btn-outline" onClick={cancelAnalysis}>Cancelar</button>
          </div>
        )}

        {/* Resumen de precisión */}
        {summary && (
          <div className="accuracy-card">
            <div className="accuracy-player">
              <span className="acc-name">♔ {h.White ?? "Blancas"}</span>
              <span className="acc-value">{summary.white.accuracy}</span>
            </div>
            <div className="accuracy-vs">Precisión</div>
            <div className="accuracy-player">
              <span className="acc-name">♚ {h.Black ?? "Negras"}</span>
              <span className="acc-value">{summary.black.accuracy}</span>
            </div>
          </div>
        )}

        {summary && (
          <div className="class-summary">
            {["brilliant", "best", "excellent", "good", "inaccuracy", "mistake", "blunder", "miss"].map(k => {
              const w = summary.white.counts[k] || 0;
              const b = summary.black.counts[k] || 0;
              if (w === 0 && b === 0) return null;
              const labels = {
                brilliant: "¡¡Brillantes!!", best: "Mejores", excellent: "Excelentes",
                good: "Buenas", inaccuracy: "Imprecisiones", mistake: "Errores",
                blunder: "Errores graves", miss: "Mates perdidos",
              };
              return (
                <div key={k} className="class-row" style={{ color: CLASS_STYLE[k].color }}>
                  <span className="class-count">{w}</span>
                  <span className="class-label">{labels[k]}</span>
                  <span className="class-count">{b}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Explicación de la jugada actual */}
        {currentAnalysis && (
          <div
            className="move-explain-card"
            style={{
              borderColor: CLASS_STYLE[currentAnalysis.classification.key]?.color,
              background: CLASS_STYLE[currentAnalysis.classification.key]?.bg,
            }}
          >
            <div className="explain-header">
              <span
                className="explain-badge"
                style={{ background: CLASS_STYLE[currentAnalysis.classification.key]?.color }}
              >
                {currentAnalysis.classification.icon} {currentAnalysis.classification.label}
              </span>
              <span className="explain-move">
                {Math.floor(ply / 2) + 1}{ply % 2 === 0 ? "." : "..."} {formatSan(currentAnalysis.san, esNotation)}
              </span>
              <span className="explain-eval">{fmtEval(currentAnalysis)}</span>
            </div>
            <p className="explain-text">{translateSanInText(currentAnalysis.explicacion, esNotation)}</p>
            {!["best", "brilliant", "forced"].includes(currentAnalysis.classification.key) && (
              <p className="explain-best">
                💡 Mejor era: <b>{formatSan(currentAnalysis.best_move_san, esNotation)}</b>
                {currentAnalysis.best_line_san.length > 1 &&
                  <span className="explain-line"> ({currentAnalysis.best_line_san.map(s => formatSan(s, esNotation)).join(" ")})</span>}
              </p>
            )}
          </div>
        )}

        {/* Lista de jugadas con clasificación */}
        <div className="review-moves">
          {game.plies.map((p, i) => {
            const a = analysis[i];
            const style = a ? CLASS_STYLE[a.classification.key] : null;
            return (
              <button
                key={i}
                className={`review-move ${i === ply ? "current" : ""}`}
                onClick={() => setPly(i)}
              >
                {i % 2 === 0 && <span className="move-num">{Math.floor(i / 2) + 1}.</span>}
                <span className="move-san" style={style ? { color: style.color } : undefined}>
                  {a ? a.classification.icon + " " : ""}{formatSan(p.san, esNotation)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
