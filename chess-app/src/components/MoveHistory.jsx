/**
 * MoveHistory.jsx — Historial de jugadas con replay de la partida
 *
 * ¿Qué hace?
 * 1. Muestra la lista de jugadas en notación algebraica (SAN)
 *    en pares blancas / negras, como en los libros de ajedrez.
 *
 * 2. Botón ▶ Replay — abre un modal que reproduce la partida
 *    posición por posición, con controles de:
 *      ⏮  Ir al inicio
 *      ◀  Jugada anterior
 *      ▶/⏸ Auto-play / Pausa
 *      ▶  Jugada siguiente
 *      ⏭  Ir al final
 *
 * Props:
 *   moves      {Array}  — lista de { san, color } de cada jugada
 *   fenHistory {Array}  — lista de FENs: fenHistory[0] = posición inicial,
 *                         fenHistory[i] = posición después de la jugada i-1
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Chessboard } from "react-chessboard";

// ── Modal de Replay ───────────────────────────────────────────────────────────

const GameReplayModal = ({ moves, fenHistory, onClose }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying]   = useState(false);
  const intervalRef = useRef(null);

  const totalPositions = fenHistory.length;
  const currentFen     = fenHistory[currentIdx] ?? fenHistory[0];
  const currentMove    = currentIdx > 0 ? moves[currentIdx - 1] : null;

  // Controles
  const goFirst = useCallback(() => { setIsPlaying(false); setCurrentIdx(0); }, []);
  const goLast  = useCallback(() => { setIsPlaying(false); setCurrentIdx(totalPositions - 1); }, [totalPositions]);
  const goPrev  = useCallback(() => { setIsPlaying(false); setCurrentIdx((i) => Math.max(0, i - 1)); }, []);
  const goNext  = useCallback(() => {
    setCurrentIdx((i) => {
      const next = Math.min(totalPositions - 1, i + 1);
      if (next === totalPositions - 1) setIsPlaying(false);
      return next;
    });
  }, [totalPositions]);

  // Auto-play: avanza una jugada cada 800ms
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentIdx((i) => {
          if (i >= totalPositions - 1) { setIsPlaying(false); return i; }
          return i + 1;
        });
      }, 800);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, totalPositions]);

  // Navegación con teclado
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowLeft")  goPrev();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "Escape")     onClose();
      if (e.key === " ") { e.preventDefault(); setIsPlaying((p) => !p); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goPrev, goNext, onClose]);

  // Agrupar en pares para el panel lateral
  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number:   Math.floor(i / 2) + 1,
      white:    moves[i],
      black:    moves[i + 1] || null,
      whiteIdx: i + 1,
      blackIdx: i + 2,
    });
  }

  const progress = totalPositions > 1 ? (currentIdx / (totalPositions - 1)) * 100 : 0;

  return (
    <div className="replay-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="replay-modal">

        <div className="replay-header">
          <div className="replay-title">
            <span>♟ Replay de la partida</span>
            <span className="replay-subtitle">
              {currentIdx === 0 ? "Posición inicial" : `Jugada ${currentIdx} de ${moves.length}`}
            </span>
          </div>
          <button className="replay-close" onClick={onClose}>✕</button>
        </div>

        <div className="replay-body">

          {/* Tablero de solo lectura */}
          <div className="replay-board-wrap">
            {currentMove && (
              <div className="replay-move-badge">
                <span className={`replay-color-dot ${currentMove.color}`} />
                {currentMove.color === "white" ? "Blancas" : "Negras"}: <strong>{currentMove.san}</strong>
              </div>
            )}
            {!currentMove && (
              <div className="replay-move-badge" style={{ color: "var(--text-2)" }}>
                Posición inicial
              </div>
            )}

            <Chessboard
              options={{
                position:             currentFen,
                allowDragging:        false,
                showNotation:         true,
                darkSquareStyle:      { backgroundColor: "#4a7c59" },
                lightSquareStyle:     { backgroundColor: "#f0d9b5" },
                animationDurationInMs: 200,
              }}
            />

            {/* Controles */}
            <div className="replay-controls">
              <button className="replay-btn" onClick={goFirst} disabled={currentIdx === 0} title="Inicio">⏮</button>
              <button className="replay-btn" onClick={goPrev}  disabled={currentIdx === 0} title="Anterior (←)">◀</button>
              <button
                className={`replay-btn replay-play ${isPlaying ? "playing" : ""}`}
                onClick={() => {
                  if (currentIdx >= totalPositions - 1) setCurrentIdx(0);
                  setIsPlaying((p) => !p);
                }}
                title="Play / Pausa (Espacio)"
              >
                {isPlaying ? "⏸" : "▶"}
              </button>
              <button className="replay-btn" onClick={goNext} disabled={currentIdx >= totalPositions - 1} title="Siguiente (→)">▶</button>
              <button className="replay-btn" onClick={goLast} disabled={currentIdx >= totalPositions - 1} title="Final">⏭</button>
            </div>

            {/* Barra de progreso */}
            <div className="replay-progress-bar">
              <div className="replay-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="replay-hint">← → navegar · Espacio play/pausa · Esc cerrar</p>
          </div>

          {/* Lista de jugadas clicables */}
          <div className="replay-movelist">
            <div className="replay-movelist-header">Jugadas</div>
            <div className="replay-movelist-body">
              {pairs.map((pair) => (
                <div key={pair.number} className="replay-pair">
                  <span className="replay-num">{pair.number}.</span>
                  <button
                    className={`replay-move-btn ${currentIdx === pair.whiteIdx ? "active" : ""}`}
                    onClick={() => { setIsPlaying(false); setCurrentIdx(pair.whiteIdx); }}
                  >
                    {pair.white?.san}
                  </button>
                  <button
                    className={`replay-move-btn ${currentIdx === pair.blackIdx ? "active" : ""}`}
                    onClick={() => { setIsPlaying(false); setCurrentIdx(pair.blackIdx); }}
                    disabled={!pair.black}
                  >
                    {pair.black?.san ?? "…"}
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};


// ── Componente MoveHistory ────────────────────────────────────────────────────

const MoveHistory = ({ moves = [], fenHistory = [] }) => {
  const [showReplay, setShowReplay] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moves]);

  const pairs = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white:  moves[i],
      black:  moves[i + 1] || null,
    });
  }

  const canReplay = moves.length >= 2 && fenHistory.length >= 2;

  return (
    <>
      <div className="move-history">

        <div className="mh-header">
          <span>Movimientos</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {moves.length > 0 && <span className="mh-count">{moves.length}</span>}
            {canReplay && (
              <button className="btn-replay" onClick={() => setShowReplay(true)} title="Reproducir la partida">
                ▶ Replay
              </button>
            )}
          </div>
        </div>

        {moves.length === 0 ? (
          <div className="mh-empty">La partida no ha comenzado</div>
        ) : (
          <div className="mh-list">
            {pairs.map((pair) => (
              <div key={pair.number} className="move-pair">
                <span className="move-num">{pair.number}.</span>
                <span className="move-cell move-white">{pair.white.san}</span>
                <span className="move-cell move-black">
                  {pair.black ? pair.black.san : "..."}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

      </div>

      {showReplay && (
        <GameReplayModal
          moves={moves}
          fenHistory={fenHistory}
          onClose={() => setShowReplay(false)}
        />
      )}
    </>
  );
};

export default MoveHistory;
