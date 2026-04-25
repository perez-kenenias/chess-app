/**
 * BoardEditor.jsx — Editor de posición para entrenar jugadas de libros
 *
 * Permite al usuario:
 *   1. Colocar piezas blancas y negras en cualquier casilla
 *   2. Borrar piezas individualmente o limpiar el tablero
 *   3. Pegar un FEN de un libro / base de datos
 *   4. Elegir quién juega primero (blancas o negras)
 *   5. Aplicar la posición para jugar/analizar contra Stockfish
 *
 * Props:
 *   currentFen {string}   — FEN de la partida actual (para "Posición actual")
 *   onApply    {Function} — onApply(fen, playerColor) — aplica la posición
 *   onCancel   {Function} — cierra el editor sin cambios
 */

import { useState, useCallback, useMemo } from "react";
import { Chessboard } from "react-chessboard";

// ── Constantes ────────────────────────────────────────────────────────────────

const PIECE_TYPES = ["k", "q", "r", "b", "n", "p"];

const PIECE_UNICODE = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

const PIECE_NAMES = {
  k: "Rey", q: "Dama", r: "Torre", b: "Alfil", n: "Caballo", p: "Peón",
};

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * fenToSquares — convierte un FEN a un mapa { casilla: { type, color } }.
 */
const fenToSquares = (fen) => {
  if (!fen) return {};
  try {
    const squares = {};
    const rows = fen.split(" ")[0].split("/");
    for (let ri = 0; ri < 8; ri++) {
      const rank = 8 - ri;
      let fi = 0;
      for (const ch of rows[ri] || "") {
        const n = parseInt(ch);
        if (!isNaN(n)) {
          fi += n;
        } else {
          const file = "abcdefgh"[fi];
          squares[`${file}${rank}`] = {
            type:  ch.toLowerCase(),
            color: ch === ch.toUpperCase() ? "w" : "b",
          };
          fi++;
        }
      }
    }
    return squares;
  } catch {
    return {};
  }
};

/**
 * squaresToFen — convierte el mapa de piezas a una cadena FEN válida.
 */
const squaresToFen = (squares, turn = "w") => {
  const rows = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = "";
    let empty = 0;
    for (const file of ["a","b","c","d","e","f","g","h"]) {
      const p = squares[`${file}${rank}`];
      if (p) {
        if (empty) { row += empty; empty = 0; }
        const ch = p.type;
        row += p.color === "w" ? ch.toUpperCase() : ch;
      } else {
        empty++;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join("/")} ${turn} - - 0 1`;
};

/**
 * validatePosition — verifica que la posición sea legal antes de aplicarla.
 * Retorna null si es válida, o un string con el error.
 */
const validatePosition = (squares) => {
  const pieces = Object.values(squares);
  const wk = pieces.filter(p => p.type === "k" && p.color === "w").length;
  const bk = pieces.filter(p => p.type === "k" && p.color === "b").length;
  if (wk === 0) return "Falta el Rey blanco ♔ — agrégalo al tablero";
  if (bk === 0) return "Falta el Rey negro ♚ — agrégalo al tablero";
  if (wk > 1)   return "Solo puede haber un Rey blanco ♔";
  if (bk > 1)   return "Solo puede haber un Rey negro ♚";
  for (const [sq, p] of Object.entries(squares)) {
    if (p.type === "p" && (sq[1] === "1" || sq[1] === "8")) {
      return `Un peón no puede estar en fila 1 u 8 (${sq})`;
    }
  }
  return null;
};

// ── Componente ────────────────────────────────────────────────────────────────

const BoardEditor = ({ currentFen = INITIAL_FEN, onApply, onCancel }) => {

  const [squares, setSquares]             = useState(() => fenToSquares(currentFen));
  const [selectedPiece, setSelectedPiece] = useState(null); // null | "erase" | { type, color }
  const [turn, setTurn]                   = useState("w");  // quien mueve primero (= quien juegas)
  const [validationError, setValidationError] = useState(null);

  // FEN derivado del estado actual del editor (actualiza en tiempo real)
  const editorFen = useMemo(() => squaresToFen(squares, turn), [squares, turn]);

  // ── Manejo del tablero ────────────────────────────────────────────────────────

  const handleSquareClick = useCallback(({ square }) => {
    setValidationError(null);
    if (selectedPiece === null) return;

    if (selectedPiece === "erase") {
      setSquares(prev => {
        const next = { ...prev };
        delete next[square];
        return next;
      });
    } else {
      // Colocar pieza (reemplaza lo que haya)
      setSquares(prev => ({ ...prev, [square]: { ...selectedPiece } }));
    }
  }, [selectedPiece]);

  // ── Manejo de la paleta ───────────────────────────────────────────────────────

  const handlePaletteClick = useCallback((type, color) => {
    setSelectedPiece(prev =>
      prev && prev !== "erase" && prev.type === type && prev.color === color
        ? null               // clic en la misma pieza → deseleccionar
        : { type, color }
    );
  }, []);

  const handleEraserClick = useCallback(() => {
    setSelectedPiece(prev => prev === "erase" ? null : "erase");
  }, []);

  // ── Acciones rápidas ──────────────────────────────────────────────────────────

  const handleClear = useCallback(() => {
    setSquares({});
    setValidationError(null);
  }, []);

  const handleReset = useCallback(() => {
    setSquares(fenToSquares(INITIAL_FEN));
    setTurn("w");
    setValidationError(null);
  }, []);

  const handleLoadCurrent = useCallback(() => {
    setSquares(fenToSquares(currentFen));
    const t = currentFen.split(" ")[1];
    if (t === "w" || t === "b") setTurn(t);
    setValidationError(null);
  }, [currentFen]);

  // ── Input de FEN ──────────────────────────────────────────────────────────────

  const handleFenInput = useCallback((value) => {
    try {
      const parsed = fenToSquares(value);
      if (Object.keys(parsed).length > 0) {
        setSquares(parsed);
        const t = value.split(" ")[1];
        if (t === "w" || t === "b") setTurn(t);
        setValidationError(null);
      }
    } catch {
      // FEN inválido: ignorar
    }
  }, []);

  // ── Aplicar posición ──────────────────────────────────────────────────────────

  const handleApply = useCallback(() => {
    const error = validatePosition(squares);
    if (error) {
      setValidationError(error);
      return;
    }
    // El turno del FEN determina el color del jugador humano:
    // si turno = blancas → el humano juega blancas, el bot juega negras
    const humanColor = turn === "w" ? "white" : "black";
    onApply(editorFen, humanColor);
  }, [squares, turn, editorFen, onApply]);

  // ── Texto de ayuda según selección ───────────────────────────────────────────

  const hintText = useMemo(() => {
    if (!selectedPiece) return "Selecciona una pieza de la paleta para colocarla en el tablero";
    if (selectedPiece === "erase") return "Borrador activo — haz clic en una pieza del tablero para quitarla";
    const c = selectedPiece.color === "w" ? "Blanca" : "Negra";
    return `Colocando: ${c} · ${PIECE_NAMES[selectedPiece.type]} — haz clic en una casilla`;
  }, [selectedPiece]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="board-editor">

      {/* Título */}
      <div className="editor-title">
        <span>✎ Editor de posición</span>
        <span className="editor-title-sub">Coloca piezas · Pega un FEN · Aplica para analizar</span>
      </div>

      {/* Paleta de piezas */}
      <div className="editor-palette">
        <div className="palette-row">
          <span className="palette-label">♔ Blancas</span>
          {PIECE_TYPES.map(type => (
            <button
              key={`w-${type}`}
              className={`palette-piece ${
                selectedPiece?.type === type && selectedPiece?.color === "w"
                  ? "palette-selected" : ""
              }`}
              onClick={() => handlePaletteClick(type, "w")}
              title={`${PIECE_NAMES[type]} blanca`}
            >
              {PIECE_UNICODE.w[type]}
            </button>
          ))}
        </div>

        <div className="palette-row">
          <span className="palette-label">♚ Negras</span>
          {PIECE_TYPES.map(type => (
            <button
              key={`b-${type}`}
              className={`palette-piece ${
                selectedPiece?.type === type && selectedPiece?.color === "b"
                  ? "palette-selected" : ""
              }`}
              onClick={() => handlePaletteClick(type, "b")}
              title={`${PIECE_NAMES[type]} negra`}
            >
              {PIECE_UNICODE.b[type]}
            </button>
          ))}
          <button
            className={`palette-erase ${selectedPiece === "erase" ? "palette-selected" : ""}`}
            onClick={handleEraserClick}
            title="Borrador — clic en pieza del tablero para quitarla"
          >
            ✕
          </button>
        </div>

        <div className="editor-hint-text">{hintText}</div>
      </div>

      {/* Tablero */}
      <div className={`editor-board-wrap${selectedPiece ? " editor-placing" : ""}`}>
        <Chessboard
          options={{
            position:              editorFen,
            boardOrientation:      turn === "w" ? "white" : "black",
            canDragPiece:          () => false,
            onSquareClick:         handleSquareClick,
            squareStyles:          {},
            darkSquareStyle:       { backgroundColor: "#4a7c59" },
            lightSquareStyle:      { backgroundColor: "#f0d9b5" },
            showNotation:          true,
            animationDurationInMs: 0,
          }}
        />
      </div>

      {/* FEN manual */}
      <div className="editor-fen-row">
        <span className="editor-fen-label">FEN</span>
        <input
          type="text"
          value={editorFen}
          onChange={e => handleFenInput(e.target.value)}
          className="editor-fen-input"
          placeholder="Pega un FEN de un libro o base de datos..."
          spellCheck={false}
        />
      </div>

      {/* Controles: turno + acciones */}
      <div className="editor-controls">

        {/* Selector de turno / color del jugador */}
        <div className="editor-turn-section">
          <span className="editor-control-label">Juegas como / Turno:</span>
          <div className="editor-turn-btns">
            <button
              className={`editor-turn-btn ${turn === "w" ? "editor-turn-active" : ""}`}
              onClick={() => setTurn("w")}
            >
              ♔ Blancas
            </button>
            <button
              className={`editor-turn-btn ${turn === "b" ? "editor-turn-active" : ""}`}
              onClick={() => setTurn("b")}
            >
              ♚ Negras
            </button>
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="editor-quick-row">
          <button className="editor-quick-btn" onClick={handleReset} title="Restaurar posición inicial">
            ↺ Pos. inicial
          </button>
          <button className="editor-quick-btn" onClick={handleLoadCurrent} title="Cargar posición actual de la partida">
            ← Pos. actual
          </button>
          <button className="editor-quick-btn editor-quick-clear" onClick={handleClear} title="Vaciar el tablero">
            ⊘ Limpiar
          </button>
        </div>

        {/* Error de validación */}
        {validationError && (
          <div className="editor-error">⚠ {validationError}</div>
        )}

        {/* Botones principales */}
        <div className="editor-main-btns">
          <button className="editor-btn-cancel" onClick={onCancel}>
            Cancelar
          </button>
          <button className="editor-btn-apply" onClick={handleApply}>
            ♟ Aplicar posición
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoardEditor;
