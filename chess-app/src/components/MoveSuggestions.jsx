/**
 * MoveSuggestions.jsx — Panel de sugerencias para principiantes
 *
 * ¿Qué hace?
 * Cuando es el turno del jugador, consulta al backend las 3 mejores jugadas
 * y las muestra con una explicación en lenguaje sencillo.
 *
 * Cada sugerencia incluye:
 *   - La jugada en notación algebraica (e4, Nf3, O-O...)
 *   - Un ícono de la pieza que se mueve
 *   - Una explicación táctica para principiantes
 *   - Un indicador de qué tan buena es la jugada (+0.5, +1.2...)
 *   - Al pasar el mouse, resalta esa jugada en el tablero
 *
 * Props:
 *   fen          {string}   — posición actual del tablero
 *   playerColor  {string}   — "white" o "black"
 *   gameStatus   {object}   — { turn, gameOver, isThinking }
 *   onHighlight  {Function} — callback para resaltar jugada en el tablero
 *                             recibe { from_square, to_square } o null
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

// ── Generador de explicaciones para principiantes ────────────────────────────

/**
 * getMoveExplanation — convierte datos técnicos de una jugada en una
 * frase comprensible para alguien que está aprendiendo ajedrez.
 *
 * Usa heurísticas basadas en:
 *   - Tipo de pieza (peón, caballo, alfil, torre, dama, rey)
 *   - Si es captura (gana material)
 *   - Si da jaque
 *   - Si es enroque
 *   - Si la casilla destino controla el centro
 *   - Si la pieza se está desarrollando (saliendo por primera vez)
 */
const getMoveExplanation = (move, playerColor) => {
  const { piece, san, from_square, to_square, is_capture, is_check } = move;

  // Nombres de piezas en español
  const PIECES = { p: "Peón", n: "Caballo", b: "Alfil", r: "Torre", q: "Dama", k: "Rey" };
  const pieceName = PIECES[piece] || "Pieza";

  // Enroque (corto: O-O, largo: O-O-O)
  if (san === "O-O")   return "Enroque corto — el Rey se protege detrás de las torres";
  if (san === "O-O-O") return "Enroque largo — el Rey se pone a salvo y la Torre entra al juego";

  // Jaque
  if (is_check) return `${pieceName} da jaque — el Rey rival debe reaccionar`;

  // Captura
  if (is_capture) return `${pieceName} captura en ${to_square} — ganas material`;

  // Control del centro (las 4 casillas centrales son clave en ajedrez)
  const CENTER = ["e4", "d4", "e5", "d5"];
  if (CENTER.includes(to_square)) {
    if (piece === "p") return `Peón al centro — controla casillas clave desde el inicio`;
    return `${pieceName} a ${to_square} — domina el centro del tablero`;
  }

  // Casillas extendidas del centro (útiles en aperturas)
  const EXT_CENTER = ["c4", "f4", "c5", "f5", "e3", "d3", "e6", "d6"];
  if (EXT_CENTER.includes(to_square) && piece === "p") {
    return "Peón avanza — gana espacio y prepara el desarrollo";
  }

  // Desarrollo de caballo desde posición inicial
  const KNIGHT_START = ["g1", "b1", "g8", "b8"];
  if (piece === "n" && KNIGHT_START.includes(from_square)) {
    return `Desarrolla el Caballo — activa una pieza hacia el centro`;
  }

  // Desarrollo de alfil desde posición inicial
  const BISHOP_START = ["c1", "f1", "c8", "f8"];
  if (piece === "b" && BISHOP_START.includes(from_square)) {
    return `Desarrolla el Alfil — abre diagonales importantes`;
  }

  // Torre entra al centro o a fila abierta
  if (piece === "r") {
    const rankTo = to_square[1];
    if (rankTo === "1" || rankTo === "8") return "Torre a fila abierta — más presión en el endgame";
    return `Torre activa — coordina con otras piezas`;
  }

  // Dama
  if (piece === "q") {
    if (from_square === "d1" || from_square === "d8") {
      return "Dama sale — cuidado con sacarla muy pronto, puede ser atacada";
    }
    return `Dama a ${to_square} — crea amenazas múltiples`;
  }

  // Rey (movimiento normal, no enroque)
  if (piece === "k") return `Rey se mueve — asegúrate de que esté protegido`;

  // Caso genérico para peones
  if (piece === "p") return `Peón avanza a ${to_square} — prepara el terreno`;

  return `${pieceName} a ${to_square}`;
};

// ── Formateador de puntuación ────────────────────────────────────────────────

/**
 * formatScore — convierte centipawns en texto legible.
 *   +35  → "+0.35"
 *   -120 → "-1.20"
 *   null + mate_in=3 → "Mate en 3"
 */
const formatScore = (score, mate_in) => {
  if (mate_in !== null && mate_in !== undefined) {
    return mate_in > 0 ? `Mate en ${mate_in}` : `Mate en ${Math.abs(mate_in)}`;
  }
  if (score === null || score === undefined) return "±0.00";
  const pawns = (Math.abs(score) / 100).toFixed(2);
  return score >= 0 ? `+${pawns}` : `-${pawns}`;
};

/**
 * scoreColor — color del texto según qué tan buena es la jugada.
 * Verde = ventaja, rojo = desventaja, gris = equilibrio.
 */
const scoreColor = (score, mate_in) => {
  if (mate_in !== null && mate_in !== undefined) return mate_in > 0 ? "#4ade80" : "#f87171";
  if (score === null) return "#888";
  if (score > 80)  return "#4ade80";  // verde: ventaja clara
  if (score > 20)  return "#a3e635";  // verde claro
  if (score > -20) return "#888";     // equilibrio
  if (score > -80) return "#fb923c";  // naranja: ligera desventaja
  return "#f87171";                   // rojo: desventaja clara
};

// ── Componente principal ─────────────────────────────────────────────────────

const MoveSuggestions = ({ fen, playerColor, gameStatus, onHighlight }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [expanded, setExpanded]       = useState(true);  // panel abierto/cerrado
  const abortRef = useRef(null); // para cancelar peticiones anteriores si cambia el FEN

  const { turn, gameOver, isThinking } = gameStatus || {};
  const myTurn = playerColor === "white" ? "w" : "b";
  const isMyTurn = turn === myTurn && !gameOver && !isThinking;

  /**
   * Cada vez que cambia el FEN y es el turno del jugador,
   * pedimos las mejores jugadas al backend.
   *
   * Usamos un flag de cancelación (abortRef) para evitar que
   * respuestas de peticiones anteriores sobreescriban el estado actual.
   */
  useEffect(() => {
    if (!isMyTurn || !fen) {
      setSuggestions([]);
      return;
    }

    // Cancelar petición anterior si aún estaba en vuelo
    abortRef.current = false;
    const cancelled = () => abortRef.current;

    setLoading(true);
    setSuggestions([]);

    getTopMoves(fen, 3, 1.5)
      .then((res) => {
        if (cancelled()) return;
        setSuggestions(res?.data?.moves ?? []);
      })
      .catch(() => {
        if (!cancelled()) setSuggestions([]);
      })
      .finally(() => {
        if (!cancelled()) setLoading(false);
      });

    return () => { abortRef.current = true; };
  }, [fen, isMyTurn]);

  // Si no es el turno del jugador o la partida terminó, ocultar el panel
  if (!isMyTurn && suggestions.length === 0 && !loading) return null;

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

          {/* Estado de carga */}
          {loading && (
            <div className="suggestions-loading">
              <div className="thinking-spinner" style={{ width: 16, height: 16, borderWidth: 1.5 }} />
              <span>Analizando posición…</span>
            </div>
          )}

          {/* Lista de sugerencias */}
          {!loading && suggestions.map((move, idx) => {
            const icon = PIECE_ICONS[move.piece]?.[playerColor] ?? "♙";
            const explanation = getMoveExplanation(move, playerColor);
            const scoreText   = formatScore(move.score, move.mate_in);
            const color       = scoreColor(move.score, move.mate_in);
            const rank = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";

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

                {/* Explicación táctica */}
                <div className="suggestion-explanation">{explanation}</div>

                {/* Badges de propiedades especiales */}
                <div className="suggestion-badges">
                  {move.is_capture && <span className="badge badge-capture">⚔ Captura</span>}
                  {move.is_check   && <span className="badge badge-check">+ Jaque</span>}
                  {(move.san === "O-O" || move.san === "O-O-O") &&
                    <span className="badge badge-castle">🏰 Enroque</span>}
                </div>
              </div>
            );
          })}

          {/* Mensaje cuando no hay sugerencias */}
          {!loading && suggestions.length === 0 && isMyTurn && (
            <div className="suggestions-empty">No hay sugerencias disponibles</div>
          )}

          {/* Nota educativa al pie */}
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
