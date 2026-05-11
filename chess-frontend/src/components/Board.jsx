/**
 * Board.jsx — El tablero de ajedrez interactivo (react-chessboard v5)
 *
 * Flujo de juego:
 *   1. Jugador arrastra una pieza o hace clic → onDrop / onSquareClick
 *   2. chess.js valida si el movimiento es legal
 *   3. Si es legal → actualizamos el estado local del tablero
 *   4. Llamamos al backend: POST /api/move con el FEN actual
 *   5. Backend responde con la jugada del bot en formato UCI (ej: "e7e5")
 *   6. Aplicamos esa jugada → el tablero se actualiza visualmente
 *
 * API de react-chessboard v5:
 *   Todos los ajustes van dentro de options={{}}.
 *   Los callbacks reciben objetos:
 *     onPieceDrop:  ({ piece, sourceSquare, targetSquare }) => boolean
 *     onSquareClick: ({ piece, square }) => void
 *     canDragPiece: ({ piece, square }) => boolean
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { getBotMove, evaluatePosition } from "../api/chess";

// ── Constantes ────────────────────────────────────────────────────────────────

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

// Las 64 casillas en el orden visual para blancas y negras
const SQUARES_WHITE = RANKS.flatMap((rank) => FILES.map((f) => `${f}${rank}`));
const SQUARES_BLACK = [...RANKS].reverse().flatMap((rank) =>
  [...FILES].reverse().map((f) => `${f}${rank}`)
);

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const BOARD_THEMES = {
  classic: { dark: "#4a7c59", light: "#f0d9b5" },
  blue:    { dark: "#4169a8", light: "#d9e6f5" },
  brown:   { dark: "#a0652a", light: "#f2d9b1" },
  gray:    { dark: "#5c5c5c", light: "#cecece" },
  red:     { dark: "#8b2635", light: "#e8c87a" },
  purple:  { dark: "#5e4185", light: "#d9ccf0" },
};

// ── Componente ────────────────────────────────────────────────────────────────

const Board = ({
  fen,
  onFenChange,
  onMoveMade,
  onGameStatus,
  onEvaluation,
  playerColor  = "white",
  skillLevel   = 10,
  settings     = {},
  hintMove         = null,
  analysisMode     = false,    // true = mueve ambos colores, sin bot
  opponentSquares  = {},        // { sq: "attacker"|"attacked" } — amenazas del rival
}) => {

  // ── Estado local ────────────────────────────────────────────────────────────

  // game: motor de reglas chess.js. Fuente de verdad del tablero.
  const [game, setGame]           = useState(() => new Chess(fen));
  const [isThinking, setIsThinking] = useState(false);
  const [lastMove, setLastMove]   = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [legalDots, setLegalDots] = useState({});
  const [botError, setBotError]   = useState(null); // mensaje de error visible
  const [boardSize, setBoardSize] = useState(560);

  const boardRef = useRef(null);

  // lastSentFen: el último FEN que nosotros mismos enviamos a App.jsx con onFenChange.
  const lastSentFen = useRef(fen);

  // gameRef: acceso al game actual dentro de callbacks asíncronos (evita stale closures).
  const gameRef = useRef(game);
  useEffect(() => { gameRef.current = game; }, [game]);

  // analysisModeRef: acceso al modo análisis dentro de callbacks asíncronos.
  const analysisModeRef = useRef(analysisMode);
  useEffect(() => { analysisModeRef.current = analysisMode; }, [analysisMode]);


  // ── Sincronización con el prop fen (nueva partida) ───────────────────────────

  /**
   * Este useEffect solo actúa cuando el FEN cambia EXTERNAMENTE:
   * es decir, cuando App.jsx reinicia la partida o cambia el color.
   *
   * ¿Cómo distinguimos interno de externo?
   * Guardamos en lastSentFen.current el último FEN que nosotros enviamos.
   * Si el nuevo prop fen coincide → fue un cambio interno, lo ignoramos.
   * Si no coincide → fue externo (nueva partida), reseteamos todo.
   *
   * Esta estrategia es más robusta que un booleano porque:
   * - No tiene condición de carrera con operaciones asíncronas
   * - No se ve afectada por React Strict Mode (que ejecuta efectos dos veces)
   */
  useEffect(() => {
    if (fen === lastSentFen.current) return; // cambio interno, ignorar
    // Cambio externo: nueva partida o cambio de color
    lastSentFen.current = fen;
    const newGame = new Chess(fen);
    setGame(newGame);
    gameRef.current = newGame;
    setLastMove(null);
    setLegalDots({});
    setSelectedSquare(null);
    setIsThinking(false);
    setBotError(null);
  }, [fen]);


  // ── Bot mueve primero cuando el jugador elige negras ─────────────────────────

  useEffect(() => {
    // En modo análisis el bot nunca mueve
    if (analysisMode) return;
    if (playerColor === "black" && fen === INITIAL_FEN) {
      setBotError(null);
      const startGame = new Chess(INITIAL_FEN);
      const timer = setTimeout(() => {
        triggerBotMove(INITIAL_FEN, startGame);
      }, 400);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerColor, fen, analysisMode]);


  // ── ResizeObserver para el overlay de casillas ───────────────────────────────

  useEffect(() => {
    if (!boardRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setBoardSize(entry.contentRect.width);
    });
    ro.observe(boardRef.current);
    return () => ro.disconnect();
  }, []);


  // ── Funciones del motor de juego ─────────────────────────────────────────────

  /**
   * reportStatus — informa a App.jsx el estado actual del juego.
   */
  const reportStatus = useCallback((g, thinking = false) => {
    onGameStatus?.({
      turn:       g.turn(),
      inCheck:    g.inCheck(),
      gameOver:   g.isGameOver(),
      result:     g.isGameOver()
        ? (g.isDraw() ? "1/2-1/2" : g.turn() === "w" ? "0-1" : "1-0")
        : null,
      isThinking: thinking,
    });
  }, [onGameStatus]);

  /**
   * triggerBotMove — pide al backend la jugada del bot y la aplica.
   *
   * Recibe el FEN y el objeto Chess DESPUÉS del movimiento del jugador.
   * Es una función regular (no useCallback) que se llama desde callbacks
   * y efectos. Usa refs para acceder al estado actual sin stale closures.
   *
   * Flujo:
   *   1. Muestra "Stockfish pensando..." bloqueando el tablero
   *   2. POST /api/move → backend calcula con Stockfish
   *   3. Recibe UCI ("e7e5") → aplica en chess.js → actualiza tablero
   *   4. Evalúa la posición para la barra de ventaja
   */
  const triggerBotMove = async (currentFen, currentGame) => {
    // En modo análisis el humano mueve ambos colores — el bot nunca responde
    if (analysisModeRef.current) return;

    setBotError(null);
    setIsThinking(true);
    reportStatus(currentGame, true);

    try {
      const res = await getBotMove(currentFen, skillLevel);

      // res.data.move es la jugada en formato UCI: "e7e5", "g8f6", "e1g1"
      const uci = res?.data?.move;
      if (!uci) {
        // El backend indicó que la partida ya terminó (move: null)
        reportStatus(currentGame, false);
        return;
      }

      // Parsear UCI: los primeros 2 chars = origen, siguientes 2 = destino
      // Si tiene 5 chars, el último es la pieza de coronación ("q", "r", "b", "n")
      const from      = uci.slice(0, 2);
      const to        = uci.slice(2, 4);
      const promotion = uci.length === 5 ? uci[4] : undefined;

      // Aplicar la jugada del bot sobre una copia del estado actual del juego
      // Usamos currentGame (parámetro) no gameRef, porque currentGame refleja
      // el estado DESPUÉS del último movimiento del jugador.
      const botGame = new Chess(currentGame.fen());
      const move    = botGame.move({ from, to, promotion });

      if (!move) {
        setBotError(`El bot sugirió un movimiento inválido: ${uci}`);
        return;
      }

      // El movimiento es válido — actualizar el estado del tablero
      const newFen = botGame.fen();

      // Marcamos lastSentFen ANTES de llamar onFenChange para que el
      // useEffect de sincronización sepa que este cambio es interno.
      lastSentFen.current = newFen;

      setLastMove({ from, to });
      setGame(botGame);
      gameRef.current = botGame;
      onFenChange?.(newFen);
      // Pasamos fenBefore (currentGame.fen()) para el comentario GM del rival
      onMoveMade?.({ san: move.san, uci: move.from + move.to + (move.promotion || ""), color: playerColor === "white" ? "black" : "white", fen: newFen, fenBefore: currentGame.fen() });
      reportStatus(botGame, false);

      // Evaluar la posición para la barra de ventaja (no bloqueante)
      try {
        const evalRes = await evaluatePosition(newFen, 12);
        onEvaluation?.({
          score:  evalRes?.data?.centipawns ?? 0,
          mateIn: evalRes?.data?.mate_in ?? null,
        });
      } catch {
        // Si falla la evaluación, no interrumpir el juego
      }

    } catch (err) {
      // Error en la llamada a /api/move — mostrarlo visualmente
      const msg = err?.response?.data?.detail ?? err?.message ?? "Error desconocido";
      setBotError(`Error del bot: ${msg}`);
      reportStatus(currentGame, false);
      console.error("Error en triggerBotMove:", err);
    } finally {
      setIsThinking(false);
    }
  };

  /**
   * applyPlayerMove — valida y aplica el movimiento del jugador.
   *
   * Retorna true si el movimiento fue legal (para react-chessboard),
   * false si fue ilegal (la pieza vuelve a su posición original).
   *
   * Después de un movimiento válido, pide la respuesta del bot.
   */
  const applyPlayerMove = useCallback((fromSq, toSq) => {
    setBotError(null);

    // Capturar FEN antes de aplicar el movimiento (para el comentario GM)
    const fenBefore = gameRef.current.fen();

    // Crear una copia del juego actual y aplicar el movimiento
    const copy = new Chess(fenBefore);
    let move;
    try {
      // promotion: "q" = coronación automática a reina (lo más habitual)
      move = copy.move({ from: fromSq, to: toSq, promotion: "q" });
    } catch {
      return false; // Movimiento ilegal según las reglas del ajedrez
    }
    if (!move) return false;

    const newFen = copy.fen();

    // Actualizar estado: marcar lastSentFen antes de notificar al padre
    lastSentFen.current = newFen;
    setLastMove({ from: fromSq, to: toSq });
    setLegalDots({});
    setSelectedSquare(null);
    setGame(copy);
    gameRef.current = copy;
    onFenChange?.(newFen);
    // Pasamos fenBefore y uci para el análisis de comentario GM
    onMoveMade?.({ san: move.san, uci: move.from + move.to + (move.promotion || ""), color: playerColor, fen: newFen, fenBefore });
    reportStatus(copy, false);

    // Si la partida no terminó, pedirle al bot que responda
    if (!copy.isGameOver()) {
      triggerBotMove(newFen, copy);
    }

    return true; // react-chessboard mantiene la pieza en el destino
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFenChange, onMoveMade, playerColor, reportStatus]);


  // ── Callbacks para react-chessboard v5 ─────────────────────────────────────

  /**
   * onDrop — se llama cuando el jugador suelta una pieza tras arrastrarla.
   *
   * En v5 recibe un objeto: { piece, sourceSquare, targetSquare }
   *   piece:        "wP", "bN", "wK", etc. (color + tipo)
   *   sourceSquare: casilla de origen ("e2")
   *   targetSquare: casilla de destino ("e4")
   *
   * Retorna true para aceptar el movimiento, false para rechazarlo.
   */
  const onDrop = useCallback(({ piece, sourceSquare, targetSquare }) => {
    if (isThinking || gameRef.current.isGameOver()) return false;

    if (!analysisMode) {
      // Modo normal: solo mover piezas propias en turno propio
      const pieceColor = piece[0] === "w" ? "white" : "black";
      if (pieceColor !== playerColor) return false;
      const myTurn = playerColor === "white" ? "w" : "b";
      if (gameRef.current.turn() !== myTurn) return false;
    } else {
      // Modo análisis: solo verificar que sea el turno correcto para esa pieza
      const pieceColor = piece[0] === "w" ? "w" : "b";
      if (gameRef.current.turn() !== pieceColor) return false;
    }

    return applyPlayerMove(sourceSquare, targetSquare);
  }, [isThinking, playerColor, analysisMode, applyPlayerMove]);

  /**
   * onSquareClick — se llama cuando el jugador hace clic en una casilla.
   *
   * En v5 recibe: { piece, square }
   *   piece:  la pieza en esa casilla (puede ser null)
   *   square: nombre de la casilla ("e4")
   *
   * Lógica de dos clics:
   *   1er clic en pieza propia → seleccionarla, mostrar destinos posibles
   *   2do clic en destino legal → ejecutar el movimiento
   */
  const onSquareClick = useCallback(({ square }) => {
    if (isThinking || gameRef.current.isGameOver()) return;

    const currentGame = gameRef.current;
    const pieceOnSquare = currentGame.get(square);
    // En modo análisis cualquier pieza del turno actual es "propia"
    const activeTurn = currentGame.turn(); // "w" o "b"
    const myTurn = analysisMode ? activeTurn : (playerColor === "white" ? "w" : "b");

    // Si hay casilla seleccionada y se clicó en un destino legal → mover
    if (selectedSquare && legalDots[square]) {
      applyPlayerMove(selectedSquare, square);
      return;
    }

    // Si se clicó en una pieza del turno activo → seleccionarla
    if (pieceOnSquare && pieceOnSquare.color === myTurn) {
      const legalMoves = currentGame.moves({ square, verbose: true });
      const dots = {};
      legalMoves.forEach((m) => {
        dots[m.to] = {
          background: currentGame.get(m.to)
            ? "radial-gradient(circle, rgba(220,50,50,0.55) 80%, transparent 80%)"
            : "radial-gradient(circle, rgba(255,255,255,0.28) 28%, transparent 28%)",
          borderRadius: "50%",
        };
      });
      setLegalDots(dots);
      setSelectedSquare(square);
      return;
    }

    // Clic en casilla vacía o pieza del turno contrario → deseleccionar
    setLegalDots({});
    setSelectedSquare(null);
  }, [isThinking, playerColor, analysisMode, selectedSquare, legalDots, applyPlayerMove]);

  /**
   * canDragPiece — le dice a react-chessboard qué piezas se pueden arrastrar.
   *
   * En v5 recibe: { piece, square, isSparePiece }
   * Retorna true si se puede arrastrar esa pieza, false si no.
   */
  const canDragPiece = useCallback(({ piece }) => {
    if (isThinking || gameRef.current.isGameOver()) return false;
    if (analysisMode) {
      // En análisis: puede arrastrar la pieza del turno actual
      const pieceColor = piece[0]; // "w" o "b"
      return gameRef.current.turn() === pieceColor;
    }
    const pieceColor = piece[0] === "w" ? "white" : "black";
    if (pieceColor !== playerColor) return false;
    const myTurn = playerColor === "white" ? "w" : "b";
    return gameRef.current.turn() === myTurn;
  }, [isThinking, playerColor, analysisMode]);


  // ── Estilos de casillas ─────────────────────────────────────────────────────

  /**
   * buildSquareStyles — construye el objeto de estilos CSS por casilla.
   *
   * react-chessboard v5 lo recibe como squareStyles dentro de options.
   * La clave es el nombre de la casilla ("e4"), el valor es CSS.
   *
   * Capas de estilos (en orden de prioridad de arriba a abajo):
   *   1. Puntos de movimientos legales (legalDots)
   *   2. Casilla seleccionada (amarillo)
   *   3. Último movimiento (amarillo suave)
   *   4. Pista de Stockfish (azul)
   *   5. Rey en jaque (rojo)
   */
  const buildSquareStyles = () => {
    const styles = { ...legalDots };

    // Amenazas del rival: piezas que atacan (naranja) y tus piezas atacadas (glow rojo)
    Object.entries(opponentSquares).forEach(([sq, type]) => {
      if (type === "attacker") {
        styles[sq] = {
          ...styles[sq],
          backgroundColor: "rgba(251, 146, 60, 0.28)",
          boxShadow: "inset 0 0 0 2px rgba(251,146,60,0.55)",
        };
      } else if (type === "attacked") {
        styles[sq] = {
          ...styles[sq],
          boxShadow: "inset 0 0 0 3px rgba(220, 50, 50, 0.75)",
        };
      }
    });

    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        backgroundColor: "rgba(255, 214, 0, 0.5)",
      };
    }

    if (lastMove) {
      styles[lastMove.from] = { ...styles[lastMove.from], backgroundColor: "rgba(255, 214, 0, 0.32)" };
      styles[lastMove.to]   = { ...styles[lastMove.to],   backgroundColor: "rgba(255, 214, 0, 0.44)" };
    }

    if (hintMove) {
      styles[hintMove.from_square] = {
        backgroundColor: "rgba(80, 160, 255, 0.5)",
        boxShadow: "inset 0 0 0 3px rgba(80,160,255,0.85)",
      };
      styles[hintMove.to_square] = {
        backgroundColor: "rgba(80, 160, 255, 0.38)",
        boxShadow: "inset 0 0 0 3px rgba(80,160,255,0.6)",
      };
    }

    if (game.inCheck()) {
      const turn = game.turn();
      for (const rank of ["1","2","3","4","5","6","7","8"]) {
        for (const file of FILES) {
          const sq = `${file}${rank}`;
          const p  = game.get(sq);
          if (p && p.type === "k" && p.color === turn) {
            styles[sq] = {
              backgroundColor: "rgba(220, 50, 50, 0.6)",
              boxShadow: "inset 0 0 0 3px rgba(220,50,50,0.9)",
            };
          }
        }
      }
    }

    return styles;
  };


  // ── Overlay de nombres de casilla ───────────────────────────────────────────

  /**
   * renderSquareLabels — grid 8x8 absolutamente posicionado encima del tablero.
   *
   * react-chessboard v5 no tiene esta opción nativa, la construimos nosotros.
   * pointerEvents: "none" asegura que no interfiere con el drag y click.
   * Solo se renderiza cuando settings.showSquareLabels = true.
   */
  const renderSquareLabels = () => {
    if (!settings.showSquareLabels) return null;

    const squares  = playerColor === "white" ? SQUARES_WHITE : SQUARES_BLACK;
    const cellSize = boardSize / 8;

    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          gridTemplateColumns: `repeat(8, ${cellSize}px)`,
          gridTemplateRows:    `repeat(8, ${cellSize}px)`,
          pointerEvents: "none",
          zIndex: 5,
        }}
      >
        {squares.map((sq) => (
          <div
            key={sq}
            style={{
              width:          cellSize,
              height:         cellSize,
              display:        "flex",
              alignItems:     "flex-end",
              justifyContent: "flex-start",
              padding:        "2px 3px",
              pointerEvents:  "none",
            }}
          >
            <span
              style={{
                fontSize:   Math.max(11, cellSize * 0.22) + "px",
                fontFamily: "monospace",
                fontWeight: "800",
                color:      "rgba(255,255,255,0.90)",
                textShadow: "0 1px 4px rgba(0,0,0,0.9)",
                userSelect: "none",
                lineHeight: 1,
              }}
            >
              {sq}
            </span>
          </div>
        ))}
      </div>
    );
  };


  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div ref={boardRef} style={{ position: "relative", width: "100%" }}>

      {/* Overlay de "pensando" */}
      {isThinking && (
        <div className="thinking-overlay">
          <div className="thinking-spinner" />
          <span>Stockfish pensando...</span>
        </div>
      )}

      {/* Error visible del bot (para depuración y mejor UX) */}
      {botError && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            left: 8,
            right: 8,
            zIndex: 10,
            background: "rgba(180, 30, 30, 0.92)",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "monospace",
          }}
        >
          ⚠ {botError}
        </div>
      )}

      {/*
        react-chessboard v5: TODOS los ajustes van dentro de options={{}}.

        Prop v4 → v5:
          position            → position         (igual)
          boardOrientation    → boardOrientation  (igual)
          onPieceDrop         → onPieceDrop       (firma distinta)
          onSquareClick       → onSquareClick     (firma distinta)
          customSquareStyles  → squareStyles
          customDarkSquareStyle  → darkSquareStyle
          customLightSquareStyle → lightSquareStyle
          showBoardNotation   → showNotation
          animationDuration   → animationDurationInMs
          arePiecesDraggable  → (reemplazado por) canDragPiece
      */}
      <Chessboard
        options={{
          position:              game.fen(),
          boardOrientation:      playerColor,
          onPieceDrop:           onDrop,
          onSquareClick:         onSquareClick,
          canDragPiece:          canDragPiece,
          squareStyles:          buildSquareStyles(),
          darkSquareStyle:       { backgroundColor: (BOARD_THEMES[settings.boardTheme] ?? BOARD_THEMES.classic).dark },
          lightSquareStyle:      { backgroundColor: (BOARD_THEMES[settings.boardTheme] ?? BOARD_THEMES.classic).light },
          showNotation:          settings.showCoordinates ?? true,
          animationDurationInMs: 200,
        }}
      />

      {renderSquareLabels()}
    </div>
  );
};

export default Board;
