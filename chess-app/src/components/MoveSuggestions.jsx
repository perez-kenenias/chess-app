/**
 * MoveSuggestions.jsx — Panel de sugerencias con análisis del rival y tips
 *
 * ¿Qué hace?
 * 1. Muestra las 3 mejores jugadas para el jugador con explicación táctica
 * 2. Muestra la estrategia actual del rival ("¿Qué busca el rival?")
 * 3. Por cada jugada, muestra la posible respuesta del rival
 * 4. Tips de entrenamiento para mejorar de amateur a avanzado
 *
 * Props:
 *   fen          {string}   — posición actual del tablero
 *   playerColor  {string}   — "white" o "black"
 *   gameStatus   {object}   — { turn, gameOver, isThinking }
 *   onHighlight  {Function} — callback para resaltar jugada en el tablero
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

// ── Explicación de la jugada del jugador ─────────────────────────────────────

const getMoveExplanation = (move, playerColor) => {
  const { piece, san, from_square, to_square, is_capture, is_check } = move;
  const PIECES = { p: "Peón", n: "Caballo", b: "Alfil", r: "Torre", q: "Dama", k: "Rey" };
  const pieceName = PIECES[piece] || "Pieza";

  if (san === "O-O")   return "Enroque corto — el Rey se protege detrás de las torres";
  if (san === "O-O-O") return "Enroque largo — el Rey se pone a salvo y la Torre entra al juego";
  if (is_check) return `${pieceName} da jaque — el Rey rival debe reaccionar`;
  if (is_capture) return `${pieceName} captura en ${to_square} — ganas material`;

  const CENTER = ["e4", "d4", "e5", "d5"];
  if (CENTER.includes(to_square)) {
    if (piece === "p") return "Peón al centro — controla casillas clave desde el inicio";
    return `${pieceName} a ${to_square} — domina el centro del tablero`;
  }

  const EXT_CENTER = ["c4", "f4", "c5", "f5", "e3", "d3", "e6", "d6"];
  if (EXT_CENTER.includes(to_square) && piece === "p") {
    return "Peón avanza — gana espacio y prepara el desarrollo";
  }

  const KNIGHT_START = ["g1", "b1", "g8", "b8"];
  if (piece === "n" && KNIGHT_START.includes(from_square)) {
    return "Desarrolla el Caballo — activa una pieza hacia el centro";
  }

  const BISHOP_START = ["c1", "f1", "c8", "f8"];
  if (piece === "b" && BISHOP_START.includes(from_square)) {
    return "Desarrolla el Alfil — abre diagonales importantes";
  }

  if (piece === "r") {
    const rankTo = to_square[1];
    if (rankTo === "1" || rankTo === "8") return "Torre a fila abierta — más presión en el endgame";
    return "Torre activa — coordina con otras piezas";
  }

  if (piece === "q") {
    if (from_square === "d1" || from_square === "d8") {
      return "Dama sale — cuidado con sacarla muy pronto, puede ser atacada";
    }
    return `Dama a ${to_square} — crea amenazas múltiples`;
  }

  if (piece === "k") return "Rey se mueve — asegúrate de que esté protegido";
  if (piece === "p") return `Peón avanza a ${to_square} — prepara el terreno`;
  return `${pieceName} a ${to_square}`;
};

// ── Estrategia actual del rival ──────────────────────────────────────────────

/**
 * getOpponentPlan — analiza la posición actual para explicar qué busca el rival.
 * Se llama una vez por posición, no por jugada.
 */
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
      if (centerPawns >= 2) return "Rival domina el centro con sus peones — busca espacio para sus piezas";
      if (developedMinors >= 3) return "Rival tiene piezas activas — prepara un ataque coordinado";
      return "Rival completa su apertura — desarrolla sus piezas hacia el centro";
    }
    if (fullmove <= 22) {
      if (activeQueen) return "Rival tiene la Dama en posición agresiva — busca amenazas múltiples";
      if (developedMinors >= 3) return "Rival busca debilitar tu estructura de peones o crear un ataque";
      return "Rival busca activar todas sus piezas antes de atacar";
    }
    return "Rival activa su Rey y avanza peones — en el final cada jugada cuenta";
  } catch {
    return null;
  }
};

// ── Posible respuesta del rival tras cada jugada sugerida ───────────────────

/**
 * getOpponentResponse — analiza qué puede hacer el rival inmediatamente
 * después de que el jugador haga la jugada sugerida (usa fen_after).
 */
const getOpponentResponse = (move) => {
  try {
    const afterChess = new Chess(move.fen_after);
    if (afterChess.isCheckmate()) return "¡Es jaque mate — la partida termina aquí!";

    const oppMoves = afterChess.moves({ verbose: true });
    const checks   = oppMoves.filter(m => m.san.includes("+"));
    const captures = oppMoves.filter(m => m.captured);

    if (checks.length >= 2) return `Rival tiene ${checks.length} jaques posibles — mantente alerta`;
    if (checks.length === 1) return `Rival puede responder con jaque: ${checks[0].san}`;
    if (captures.length >= 3) return "Rival tiene múltiples capturas disponibles — vigila tu material";
    if (captures.length === 1) {
      const pieceNames = { p: "peón", n: "caballo", b: "alfil", r: "torre", q: "dama" };
      const name = pieceNames[captures[0].captured] ?? "pieza";
      return `Rival podría capturar tu ${name} en ${captures[0].to}`;
    }
    return "Rival buscará la mejor continuación posicional";
  } catch {
    return null;
  }
};

// ── Tips de entrenamiento para progresar ─────────────────────────────────────

const TRAINING_TIPS = [
  "En cada turno pregúntate: ¿Mejoro mis piezas? ¿Amenazo algo? ¿Debilito mi posición?",
  "Antes de mover, busca capturas, jaques y amenazas del rival. No muevas sin razón.",
  "Piezas activas > ventaja material. Una pieza mal colocada es un peso muerto.",
  "Controla el centro con peones y piezas desde el inicio — el centro da movilidad.",
  "Enroca pronto. Un Rey seguro te permite atacar con libertad sin preocuparte.",
  "Las torres son más potentes en columnas abiertas o semabiertas. Búscalas.",
  "No muevas la misma pieza dos veces en la apertura sin razón táctica concreta.",
  "El Rey es una pieza fuerte en el final — acércalo al centro de la acción.",
  "Coordina tus piezas: un ataque con varias piezas es más difícil de defender.",
  "Cada peón pasado es una amenaza de coronación que el rival debe atender.",
];

const getTrainingTip = (fen) => {
  const fullmove = parseInt(fen.split(" ")[5]) || 1;
  return TRAINING_TIPS[fullmove % TRAINING_TIPS.length];
};

// ── Formateadores ────────────────────────────────────────────────────────────

const formatScore = (score, mate_in) => {
  if (mate_in !== null && mate_in !== undefined) {
    return mate_in > 0 ? `Mate en ${mate_in}` : `Mate en ${Math.abs(mate_in)}`;
  }
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

const MoveSuggestions = ({ fen, playerColor, gameStatus, onHighlight }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);
  const [expanded, setExpanded]       = useState(true);
  const abortRef = useRef(false);

  const { turn, gameOver, isThinking } = gameStatus || {};
  const myTurn = playerColor === "white" ? "w" : "b";
  const isMyTurn = turn === myTurn && !gameOver && !isThinking;

  const opponentColor = playerColor === "white" ? "black" : "white";

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
        if (moves.length === 0) {
          setError("El backend no devolvió jugadas. Reinicia el servidor y vuelve a intentarlo.");
        }
      })
      .catch((err) => {
        if (cancelled()) return;
        const detail = err?.response?.data?.detail ?? err?.message ?? "";
        if (err?.response?.status === 404) {
          setError("Endpoint /api/top-moves no encontrado. Reinicia el servidor backend.");
        } else {
          setError(`Error al obtener sugerencias${detail ? ": " + detail : ". Comprueba que el servidor esté corriendo."}`);
        }
        setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled()) setLoading(false);
      });
  };

  useEffect(() => {
    if (!isMyTurn || !fen) {
      abortRef.current = true;
      setSuggestions([]);
      setError(null);
      return;
    }
    fetchSuggestions(fen);
    return () => { abortRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, isMyTurn]);

  if (!isMyTurn && suggestions.length === 0 && !loading && !error) return null;

  // Calculamos el plan del rival y el tip de entrenamiento una sola vez
  const rivalPlan  = !loading && suggestions.length > 0 ? getOpponentPlan(fen, opponentColor) : null;
  const trainingTip = !loading && suggestions.length > 0 ? getTrainingTip(fen) : null;

  return (
    <div className="suggestions-panel">

      {/* Cabecera — con botón para colapsar */}
      <div className="suggestions-header" onClick={() => setExpanded((p) => !p)}>
        <div className="suggestions-title">
          <span className="suggestions-icon">💡</span>
          <span>Sugerencias de Stockfish</span>
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

          {/* Banner: ¿Qué busca el rival? */}
          {rivalPlan && (
            <div className="rival-context">
              <span className="rival-context-label">♟ Rival busca:</span> {rivalPlan}
            </div>
          )}

          {/* Lista de sugerencias */}
          {!loading && suggestions.map((move, idx) => {
            const icon        = PIECE_ICONS[move.piece]?.[playerColor] ?? "♙";
            const explanation = getMoveExplanation(move, playerColor);
            const scoreText   = formatScore(move.score, move.mate_in);
            const color       = scoreColor(move.score, move.mate_in);
            const rank        = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
            const oppResponse = getOpponentResponse(move);

            return (
              <div
                key={move.uci}
                className="suggestion-card"
                onMouseEnter={() => onHighlight?.({ from_square: move.from_square, to_square: move.to_square })}
                onMouseLeave={() => onHighlight?.(null)}
              >
                {/* Fila superior: rango + jugada + score */}
                <div className="suggestion-top">
                  <span className="suggestion-rank">{rank}</span>
                  <div className="suggestion-move">
                    <span className="suggestion-piece">{icon}</span>
                    <span className="suggestion-san">{move.san}</span>
                    <span className="suggestion-squares">
                      {move.from_square} → {move.to_square}
                    </span>
                  </div>
                  <span className="suggestion-score" style={{ color }}>
                    {scoreText}
                  </span>
                </div>

                {/* Explicación táctica de la jugada */}
                <div className="suggestion-explanation">{explanation}</div>

                {/* Posible respuesta del rival */}
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
