/**
 * MoveSuggestions.jsx — Panel de sugerencias con análisis táctico completo
 *
 * Features:
 * 1. Top 3 jugadas con explicación de POR QUÉ es la mejor opción
 * 2. Análisis de jugada equivocada — si el jugador no eligió la top suggestion
 * 3. Estrategia del rival — qué busca el oponente en esta posición
 * 4. Respuesta del rival tras cada sugerencia
 * 5. Squares de amenaza del rival → pasados al tablero via onOpponentSquares
 * 6. Tips de entrenamiento rotativos
 */

import { useState, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { getTopMoves } from "../api/chess";

// ── Íconos de piezas ─────────────────────────────────────────────────────────

const PIECE_ICONS = {
  p: { white: "♙", black: "♟" },
  n: { white: "♘", black: "♞" },
  b: { white: "♗", black: "♝" },
  r: { white: "♖", black: "♜" },
  q: { white: "♕", black: "♛" },
  k: { white: "♔", black: "♚" },
};

const PIECE_NAMES = { p: "peón", n: "caballo", b: "alfil", r: "torre", q: "dama", k: "rey" };
const PIECE_NAMES_CAP = { p: "Peón", n: "Caballo", b: "Alfil", r: "Torre", q: "Dama", k: "Rey" };

// ── Explicación enriquecida de por qué la jugada es la mejor ────────────────

const getMoveExplanation = (move) => {
  const { piece, san, from_square, to_square, is_capture, is_check, score, mate_in } = move;
  const pieceName = PIECE_NAMES_CAP[piece] || "Pieza";

  // Mate
  if (mate_in !== null && mate_in !== undefined && mate_in > 0) {
    return `Lleva a jaque mate en ${mate_in} jugada${mate_in > 1 ? "s" : ""} — posición ganada`;
  }

  // Movimientos especiales
  if (san === "O-O")   return "Enroque corto — el Rey queda protegido y las Torres se conectan para dominar el centro";
  if (san === "O-O-O") return "Enroque largo — el Rey se aleja del peligro y la Torre entra en juego activamente";

  const reasons = [];

  // Razón táctica principal
  if (is_check && is_capture) {
    reasons.push(`Captura en ${to_square} con jaque: ganas material y obligas al rival a reaccionar perdiendo tempo`);
  } else if (is_check) {
    reasons.push(`Da jaque: el rival debe responder obligatoriamente, perdiendo la iniciativa`);
  } else if (is_capture) {
    reasons.push(`Captura en ${to_square}: ganas material de forma directa`);
  } else {
    // Razón posicional
    const CORE    = ["e4", "d4", "e5", "d5"];
    const EXT     = ["c4", "f4", "c5", "f5", "e3", "d3", "e6", "d6", "c3", "f3", "c6", "f6"];
    const N_START = ["g1", "b1", "g8", "b8"];
    const B_START = ["c1", "f1", "c8", "f8"];
    const R_START = ["a1", "h1", "a8", "h8"];

    if (CORE.includes(to_square)) {
      if (piece === "p") reasons.push("Peón al centro: controla casillas clave, abre líneas para piezas y gana espacio");
      else reasons.push(`${pieceName} domina el centro desde ${to_square}: máxima movilidad y control del tablero`);
    } else if (EXT.includes(to_square) && (piece === "n" || piece === "b")) {
      reasons.push(`${pieceName} a casilla activa: ejerce influencia en el centro e impone presión al rival`);
    } else if (piece === "n" && N_START.includes(from_square)) {
      reasons.push("Desarrolla el Caballo hacia el centro: pieza clave que entra al juego con máxima actividad");
    } else if (piece === "b" && B_START.includes(from_square)) {
      reasons.push("Activa el Alfil: abre diagonales y genera presión a distancia sin exponerse");
    } else if (piece === "r") {
      if (R_START.includes(from_square)) reasons.push("Torre entra al juego: busca columnas abiertas o semiabiertas para mayor presión");
      else reasons.push("Torre se reposiciona en mejor columna: coordina el ataque con las otras piezas");
    } else if (piece === "q") {
      if (from_square === "d1" || from_square === "d8") reasons.push("Dama sale a posición activa: crea amenazas múltiples que el rival debe atender");
      else reasons.push(`Dama a ${to_square}: genera amenazas en varias direcciones simultáneamente`);
    } else if (piece === "p") {
      reasons.push(`Peón a ${to_square}: gana espacio, limita las opciones del rival y prepara el terreno`);
    } else {
      reasons.push(`${pieceName} a ${to_square}: mejora la coordinación y actividad de tus piezas`);
    }
  }

  // Contexto de puntuación — por qué ES LA MEJOR
  if (score !== null && score !== undefined) {
    if (score > 250)      reasons.push("Ventaja decisiva — la posición está ganada");
    else if (score > 100) reasons.push("Ventaja clara y sólida que presiona al rival");
    else if (score > 40)  reasons.push("Pequeña ventaja que acumula presión a largo plazo");
    else if (Math.abs(score) <= 40) reasons.push("Mantiene el equilibrio con máxima solidez");
    else if (score < -40) reasons.push("Reduce la desventaja de la forma más inteligente disponible");
  }

  return reasons.join(" · ");
};

// ── Análisis de la jugada equivocada del jugador ─────────────────────────────

/**
 * blunderLabel — clasifica la magnitud del error según la diferencia de evaluación.
 * "score" es la evaluación DESPUÉS de la jugada óptima (relativa al jugador).
 * Cuanto más positivo, más daño hace el error.
 */
const blunderLabel = (score, mate_in) => {
  if (mate_in !== null && mate_in !== undefined && mate_in > 0) return { text: "Mate perdido", color: "#f87171" };
  if (score === null) return { text: "Imprecisión", color: "#facc15" };
  if (score > 250)  return { text: "Error grave",   color: "#f87171" };
  if (score > 100)  return { text: "Error",          color: "#fb923c" };
  if (score > 40)   return { text: "Imprecisión",    color: "#facc15" };
  return                    { text: "Jugable",        color: "#a3e635" };
};

/**
 * getPositionalContext — genera una frase que explica qué pasa con la POSICIÓN
 * después de cada jugada, no solo qué hace la jugada tácticamente.
 */
const getPositionalContext = (fenBefore, playedSan, topSuggestion) => {
  const { san: suggestedSan, score, is_capture, is_check, piece, to_square, fen_after } = topSuggestion;

  try {
    // Analizar posición DESPUÉS de la jugada del jugador
    const chessPlayed = new Chess(fenBefore);
    const playedMove  = chessPlayed.move(playedSan);
    if (!playedMove) return null;

    // Contar movilidad del jugador tras cada jugada
    // (más movilidad = piezas más activas = mejor posición)
    const playedMobility    = chessPlayed.moves().length;

    let suggestedMobility = null;
    try {
      const chessSugg = new Chess(fen_after ?? fenBefore);
      // fen_after ya tiene el turno del rival — invertimos para medir movilidad del jugador
      const parts = chessSugg.fen().split(" ");
      const currentTurn = parts[1];
      parts[1] = currentTurn === "w" ? "b" : "w";
      // Usamos la posición tal cual para comparar número de jugadas legales
      suggestedMobility = new Chess(fen_after ?? fenBefore).moves().length;
    } catch { /* ignorar */ }

    // ── Construir explicación posicional ──────────────────────────────────────

    const lines = [];

    // 1. Qué hizo (o no hizo) la jugada del jugador
    const playedPiece = PIECE_NAMES[playedMove.piece] || "pieza";
    if (playedMove.captured) {
      lines.push(`Tu ${playedPiece} capturó en ${playedMove.to} pero no fue la captura más rentable`);
    } else {
      lines.push(`Tu ${playedPiece} se movió a ${playedMove.to} sin amenazar nada inmediato`);
    }

    // 2. Qué hacía la jugada de Stockfish
    if (is_check && is_capture) {
      lines.push(`${suggestedSan} capturaba Y daba jaque simultáneamente, forzando al rival a dos frentes`);
    } else if (is_check) {
      lines.push(`${suggestedSan} ponía al rey rival en jaque, obligándole a reaccionar y perdiendo su iniciativa`);
    } else if (is_capture) {
      lines.push(`${suggestedSan} ganaba material de inmediato, una ventaja concreta difícil de compensar`);
    } else {
      const pName = PIECE_NAMES_CAP[piece] || "Pieza";
      lines.push(`${suggestedSan} colocaba el ${pName} en ${to_square}, maximizando su influencia en el centro`);
    }

    // 3. Consecuencia posicional basada en evaluación
    if (score !== null) {
      if (score > 250)
        lines.push("Con la jugada óptima habrías tenido una posición ganadora — la ventaja era decisiva");
      else if (score > 100)
        lines.push("Tendrías ventaja clara y sólida que el rival habría tenido dificultades para neutralizar");
      else if (score > 40)
        lines.push("Una pequeña ventaja que, acumulada jugada a jugada, se convierte en presión real");
      else
        lines.push("La posición seguía siendo equilibrada, pero con más iniciativa de tu lado");
    }

    return lines.join(". ");
  } catch {
    return null;
  }
};

const getWrongMoveAnalysis = (lastPlayerMove, topSuggestion) => {
  if (!lastPlayerMove || !topSuggestion) return null;
  const { san: playedSan, fenBefore } = lastPlayerMove;
  const { san: suggestedSan, piece, from_square, to_square, is_capture, is_check, score, mate_in } = topSuggestion;

  // Analizar la jugada del jugador con chess.js
  let playedPieceName  = null;
  let playedWasCapture = false;
  let playedFromSq     = null;
  let playedToSq       = null;

  try {
    const chess = new Chess(fenBefore);
    const playedMove = chess.move(playedSan);
    if (playedMove) {
      playedPieceName  = PIECE_NAMES[playedMove.piece] || "pieza";
      playedWasCapture = !!playedMove.captured;
      playedFromSq     = playedMove.from;
      playedToSq       = playedMove.to;
    }
  } catch { /* continúa sin detalles */ }

  // Clasificación del error
  const blunder = blunderLabel(score, mate_in);

  // Explicación posicional profunda
  const positionalContext = getPositionalContext(fenBefore, playedSan, topSuggestion);

  return {
    playedSan,
    suggestedSan,
    playedPieceName,
    playedWasCapture,
    playedFromSq,
    playedToSq,
    suggestedPiece:    PIECE_NAMES[piece] || "pieza",
    suggestedFrom:     from_square,
    suggestedTo:       to_square,
    score,
    mate_in,
    blunder,
    positionalContext,
  };
};

// ── Amenazas del rival: casillas destacadas en el tablero ───────────────────

/**
 * getOpponentThreatSquares — encuentra las casillas que el rival amenaza:
 *   "attacker" = pieza rival que puede capturar algo tuyo → se pinta naranja
 *   "attacked"  = tu pieza que está bajo ataque → se pinta con glow rojo
 *
 * Técnica: invertimos el turno en el FEN para obtener los movimientos del rival.
 */
const getOpponentThreatSquares = (fen) => {
  try {
    const parts = fen.split(" ");
    const opponentTurn = parts[1] === "w" ? "b" : "w";
    parts[1] = opponentTurn;
    parts[3] = "-"; // limpiar en passant (puede ser inválido tras el flip)
    const flippedFen = parts.join(" ");

    let chess;
    try {
      chess = new Chess(flippedFen);
    } catch {
      // Si da error (rey en jaque virtual), también limpiar el enroque
      parts[2] = "-";
      chess = new Chess(parts.join(" "));
    }

    const moves = chess.moves({ verbose: true });
    const squares = {};
    moves.forEach((m) => {
      if (m.captured) {
        squares[m.from] = "attacker"; // pieza rival que amenaza
        squares[m.to]   = "attacked";  // tu pieza bajo ataque
      }
    });
    return squares;
  } catch {
    return {};
  }
};

// ── Estrategia del rival ──────────────────────────────────────────────────────

const getOpponentPlan = (fen, opponentColor) => {
  try {
    const chess = new Chess(fen);
    const oppColor = opponentColor === "white" ? "w" : "b";
    const fullmove = parseInt(fen.split(" ")[5]) || 1;
    const backRank = oppColor === "w" ? "1" : "8";
    const knightStarts = oppColor === "w" ? ["b1", "g1"] : ["b8", "g8"];
    const bishopStarts = oppColor === "w" ? ["c1", "f1"] : ["c8", "f8"];

    let developedMinors = 0;
    let centerPawns = 0;
    let activeQueen = false;

    for (const rank of ["1","2","3","4","5","6","7","8"]) {
      for (const file of ["a","b","c","d","e","f","g","h"]) {
        const sq = `${file}${rank}`;
        const p = chess.get(sq);
        if (!p || p.color !== oppColor) continue;
        if (p.type === "n" && !knightStarts.includes(sq)) developedMinors++;
        if (p.type === "b" && !bishopStarts.includes(sq)) developedMinors++;
        if (p.type === "p" && ["d","e"].includes(file) && (rank === "4" || rank === "5")) centerPawns++;
        if (p.type === "q" && sq[1] !== backRank) activeQueen = true;
      }
    }

    if (fullmove <= 8) {
      if (centerPawns >= 2) return "Rival domina el centro con peones — busca espacio para lanzar un ataque";
      if (developedMinors >= 3) return "Rival tiene piezas activas — prepara un ataque coordinado";
      return "Rival completa su apertura — desarrolla sus piezas hacia el centro";
    }
    if (fullmove <= 22) {
      if (activeQueen) return "Rival tiene la Dama en posición agresiva — busca amenazas múltiples simultáneas";
      if (developedMinors >= 3) return "Rival busca debilitar tu estructura de peones o crear un ataque directo";
      return "Rival busca activar todas sus piezas antes de atacar";
    }
    return "Rival activa su Rey y avanza peones — en el final cada jugada es decisiva";
  } catch {
    return null;
  }
};

// ── Respuesta posible del rival tras cada sugerencia ─────────────────────────

const getOpponentResponse = (move) => {
  try {
    const afterChess = new Chess(move.fen_after);
    if (afterChess.isCheckmate()) return "¡Es jaque mate — la partida termina aquí!";
    const oppMoves  = afterChess.moves({ verbose: true });
    const checks    = oppMoves.filter((m) => m.san.includes("+"));
    const captures  = oppMoves.filter((m) => m.captured);
    if (checks.length >= 2) return `Rival tiene ${checks.length} jaques posibles — mantente alerta`;
    if (checks.length === 1) return `Rival puede responder con jaque: ${checks[0].san}`;
    if (captures.length >= 3) return "Rival tiene múltiples capturas — vigila tu material";
    if (captures.length === 1) {
      const name = PIECE_NAMES[captures[0].captured] ?? "pieza";
      return `Rival podría capturar tu ${name} en ${captures[0].to}`;
    }
    return "Rival buscará la mejor continuación posicional";
  } catch {
    return null;
  }
};

// ── Tips de entrenamiento ────────────────────────────────────────────────────

const TRAINING_TIPS = [
  "En cada turno pregúntate: ¿Mejoro mis piezas? ¿Amenazo algo? ¿Debilito mi posición?",
  "Antes de mover, busca capturas, jaques y amenazas del rival. No muevas sin razón.",
  "Piezas activas > ventaja material. Una pieza mal colocada es un peso muerto.",
  "Controla el centro con peones y piezas desde el inicio — el centro da movilidad.",
  "Enroca pronto. Un Rey seguro te permite atacar con libertad sin preocuparte.",
  "Las torres son más potentes en columnas abiertas o semiabiertas. Búscalas.",
  "No muevas la misma pieza dos veces en la apertura sin razón táctica concreta.",
  "El Rey es una pieza fuerte en el final — acércalo al centro de la acción.",
  "Coordina tus piezas: un ataque con varias piezas es más difícil de defender.",
  "Cada peón pasado es una amenaza de coronación que el rival debe atender.",
];
const getTrainingTip = (fen) => TRAINING_TIPS[(parseInt(fen.split(" ")[5]) || 1) % TRAINING_TIPS.length];

// ── Formateadores ────────────────────────────────────────────────────────────

const formatScore = (score, mate_in) => {
  if (mate_in !== null && mate_in !== undefined)
    return mate_in > 0 ? `Mate en ${mate_in}` : `Mate en ${Math.abs(mate_in)}`;
  if (score === null || score === undefined) return "±0.00";
  const pawns = (Math.abs(score) / 100).toFixed(2);
  return score >= 0 ? `+${pawns}` : `-${pawns}`;
};

const scoreColor = (score, mate_in) => {
  if (mate_in !== null && mate_in !== undefined) return mate_in > 0 ? "#4ade80" : "#f87171";
  if (score === null) return "#888";
  if (score > 80)  return "#4ade80";
  if (score > 20)  return "#a3e635";
  if (score > -20) return "#888";
  if (score > -80) return "#fb923c";
  return "#f87171";
};

// ── Componente principal ─────────────────────────────────────────────────────

const MoveSuggestions = ({
  fen,
  playerColor,
  gameStatus,
  onHighlight,
  onOpponentSquares,
  onWrongMove,             // callback: (wrongMoveInfo | null) → void
  lastPlayerMove = null,   // { san, fenBefore } — última jugada del jugador
  analysisMode = false,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [expanded, setExpanded]       = useState(true);

  const abortRef = useRef(false);

  // suggestionsRef: referencia sincronizada con el estado (para closures async)
  const suggestionsRef = useRef([]);
  useEffect(() => { suggestionsRef.current = suggestions; }, [suggestions]);

  // prevSuggestionsRef: guarda las sugerencias del turno ANTERIOR del jugador
  const prevSuggestionsRef = useRef([]);

  // Seguimiento de la transición isMyTurn false→true
  const prevIsMyTurnRef = useRef(false);

  const { turn, gameOver, isThinking } = gameStatus || {};
  const myTurn = playerColor === "white" ? "w" : "b";

  const isMyTurn = analysisMode
    ? (!gameOver && !isThinking)
    : (turn === myTurn && !gameOver && !isThinking);

  const opponentColor = analysisMode
    ? (turn === "w" ? "black" : "white")
    : (playerColor === "white" ? "black" : "white");

  // ── Fetch de sugerencias ───────────────────────────────────────────────────

  const fetchSuggestions = (currentFen) => {
    abortRef.current = false;
    const cancelled = () => abortRef.current;
    setLoading(true);
    setSuggestions([]);
    setError(null);

    getTopMoves(currentFen, 3, 1.5)
      .then((res) => {
        if (cancelled()) return;
        const moves = res?.data?.moves ?? [];
        setSuggestions(moves);
        if (moves.length === 0)
          setError("El backend no devolvió jugadas. Reinicia el servidor y vuelve a intentarlo.");
      })
      .catch((err) => {
        if (cancelled()) return;
        const detail = err?.response?.data?.detail ?? err?.message ?? "";
        if (err?.response?.status === 404)
          setError("Endpoint /api/top-moves no encontrado. Reinicia el servidor backend.");
        else
          setError(`Error al obtener sugerencias${detail ? ": " + detail : ". Comprueba que el servidor esté corriendo."}`);
        setSuggestions([]);
      })
      .finally(() => { if (!cancelled()) setLoading(false); });
  };

  // ── Efecto principal: fetch o limpiar según turno ─────────────────────────

  useEffect(() => {
    if (!isMyTurn || !fen) {
      // Antes de limpiar, guardar las sugerencias actuales para análisis posterior
      if (suggestionsRef.current.length > 0) {
        prevSuggestionsRef.current = [...suggestionsRef.current];
      }
      abortRef.current = true;
      setSuggestions([]);
      setError(null);
      onOpponentSquares?.({});
      return;
    }
    fetchSuggestions(fen);
    return () => { abortRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, isMyTurn]);

  // ── Detección de jugada equivocada → notificar al padre ─────────────────

  useEffect(() => {
    const wasMyTurn = prevIsMyTurnRef.current;
    prevIsMyTurnRef.current = isMyTurn;

    // Solo actuar en la transición false → true (turno volvió al jugador)
    if (!isMyTurn || wasMyTurn) return;
    // Modo análisis: el jugador mueve ambos colores, no aplica
    if (analysisMode) { onWrongMove?.(null); return; }

    if (lastPlayerMove && prevSuggestionsRef.current.length > 0) {
      const top = prevSuggestionsRef.current[0];
      if (top && lastPlayerMove.san !== top.san) {
        onWrongMove?.(getWrongMoveAnalysis(lastPlayerMove, top));
      } else {
        onWrongMove?.(null); // ¡Buena jugada!
      }
    } else {
      onWrongMove?.(null);
    }
  }, [isMyTurn, lastPlayerMove, analysisMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Limpiar si desaparece la referencia (undo, nueva partida, etc.)
  useEffect(() => {
    if (!lastPlayerMove) onWrongMove?.(null);
  }, [lastPlayerMove]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Calcular squares de amenaza del rival ─────────────────────────────────

  useEffect(() => {
    if (!isMyTurn || suggestions.length === 0 || !fen) {
      onOpponentSquares?.({});
      return;
    }
    const squares = getOpponentThreatSquares(fen);
    onOpponentSquares?.(squares);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestions, fen, isMyTurn]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (!isMyTurn && suggestions.length === 0 && !loading && !error) return null;

  const rivalPlan   = !loading && suggestions.length > 0 ? getOpponentPlan(fen, opponentColor) : null;
  const trainingTip = !loading && suggestions.length > 0 ? getTrainingTip(fen) : null;

  return (
    <div className="suggestions-panel">

      {/* Cabecera colapsable */}
      <div className="suggestions-header" onClick={() => setExpanded((p) => !p)}>
        <div className="suggestions-title">
          <span className="suggestions-icon">{analysisMode ? "⚡" : "💡"}</span>
          <span>
            {analysisMode
              ? `Análisis · ${turn === "w" ? "♔ Turno Blancas" : "♚ Turno Negras"}`
              : "Sugerencias de Stockfish"
            }
          </span>
        </div>
        <span className="suggestions-toggle">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="suggestions-body">

          {/* Cargando */}
          {loading && (
            <div className="suggestions-loading">
              <div className="thinking-spinner" style={{ width: 16, height: 16, borderWidth: 1.5 }} />
              <span>Analizando posición…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="suggestions-error">
              <span className="suggestions-error-icon">⚠</span>
              <span className="suggestions-error-msg">{error}</span>
              <button className="suggestions-retry" onClick={() => fetchSuggestions(fen)}>
                Reintentar
              </button>
            </div>
          )}

          {/* ── Banner de estrategia del rival ── */}
          {rivalPlan && (
            <div className="rival-context">
              <span className="rival-context-label">♟ Rival busca:</span> {rivalPlan}
            </div>
          )}

          {/* ── Lista de sugerencias ── */}
          {!loading && suggestions.map((move, idx) => {
            const icon        = PIECE_ICONS[move.piece]?.[playerColor] ?? "♙";
            const explanation = getMoveExplanation(move);
            const scoreText   = formatScore(move.score, move.mate_in);
            const color       = scoreColor(move.score, move.mate_in);
            const rank        = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
            const oppResponse = getOpponentResponse(move);
            const isTop       = idx === 0;

            return (
              <div
                key={move.uci}
                className={`suggestion-card ${isTop ? "suggestion-card--top" : ""}`}
                onMouseEnter={() => onHighlight?.({ from_square: move.from_square, to_square: move.to_square })}
                onMouseLeave={() => onHighlight?.(null)}
              >
                {/* Fila superior */}
                <div className="suggestion-top">
                  <span className="suggestion-rank">{rank}</span>
                  <div className="suggestion-move">
                    <span className="suggestion-piece">{icon}</span>
                    <span className="suggestion-san">{move.san}</span>
                    <span className="suggestion-squares">
                      {move.from_square} → {move.to_square}
                    </span>
                  </div>
                  <span className="suggestion-score" style={{ color }}>{scoreText}</span>
                </div>

                {/* Explicación: POR QUÉ es la mejor jugada */}
                <div className="suggestion-explanation">{explanation}</div>

                {/* Respuesta probable del rival */}
                {oppResponse && (
                  <div className="suggestion-opponent">
                    ⚡ {oppResponse}
                  </div>
                )}

                {/* Badges */}
                <div className="suggestion-badges">
                  {move.is_capture && <span className="badge badge-capture">⚔ Captura</span>}
                  {move.is_check   && <span className="badge badge-check">+ Jaque</span>}
                  {(move.san === "O-O" || move.san === "O-O-O") &&
                    <span className="badge badge-castle">🏰 Enroque</span>}
                  {isTop && <span className="badge badge-best">★ Mejor</span>}
                </div>
              </div>
            );
          })}

          {/* Sin sugerencias */}
          {!loading && !error && suggestions.length === 0 && isMyTurn && (
            <div className="suggestions-empty">No hay sugerencias disponibles</div>
          )}

          {/* Tip de entrenamiento */}
          {trainingTip && (
            <div className="training-tip">
              <span className="training-tip-icon">📈</span>
              <span>{trainingTip}</span>
            </div>
          )}

          {/* Nota de hover */}
          {!loading && suggestions.length > 0 && (
            <p className="suggestions-note">
              Pasa el cursor sobre una jugada para verla en el tablero.
            </p>
          )}

        </div>
      )}
    </div>
  );
};

export default MoveSuggestions;
