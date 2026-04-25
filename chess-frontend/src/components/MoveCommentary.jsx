/**
 * MoveCommentary.jsx — Comentario de Gran Maestro para cada jugada
 *
 * Muestra análisis de nivel GM después de cada movimiento:
 *   - Por qué se hizo esa jugada (táctica + posicional)
 *   - Qué amenaza crea o responde
 *   - Cuál es el plan a seguir
 *   - Consejo de entrenamiento para el jugador humano
 *
 * Se muestra para AMBAS jugadas: la del jugador y la del rival.
 *
 * Props:
 *   commentary  {object|null}  — { player: {...}, bot: {...}, loading: bool }
 *   playerColor {string}       — "white" o "black"
 *   onClose     {Function}     — cierra / descarta el panel
 */

import { useState } from "react";

// ── Helpers de color y símbolo ────────────────────────────────────────────────

const PIECE_SYMBOLS = {
  white: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  black: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

const TIP_ICONS = {
  aprende:    "📖",
  mejora:     "⚡",
  bien_hecho: "🌟",
};

// ── Tarjeta individual de una jugada ─────────────────────────────────────────

const MoveCard = ({ data, isPlayer, playerColor }) => {
  const [expanded, setExpanded] = useState(true);

  if (!data) return null;

  const { titulo, razonamiento, amenaza, plan, consejo, clasificacion, move_san } = data;
  const color        = isPlayer ? playerColor : (playerColor === "white" ? "black" : "white");
  const pieceSymbol  = PIECE_SYMBOLS[color]?.p ?? "♟";
  const badgeStyle   = { color: clasificacion.color, borderColor: clasificacion.color + "55" };

  return (
    <div className={`gm-move-card ${isPlayer ? "gm-move-card--player" : "gm-move-card--bot"}`}>

      {/* Cabecera */}
      <div className="gm-card-header" onClick={() => setExpanded(p => !p)}>
        <div className="gm-card-who">
          <span className="gm-piece">{pieceSymbol}</span>
          <div>
            <span className="gm-card-label">{isPlayer ? "Tu jugada" : "Jugada del rival"}</span>
            <span className="gm-card-san">{move_san}</span>
          </div>
        </div>
        <div className="gm-card-right">
          <span className="gm-badge" style={badgeStyle}>
            {clasificacion.emoji} {clasificacion.texto}
          </span>
          <span className="gm-toggle">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="gm-card-body">

          {/* Título */}
          <div className="gm-titulo">{titulo}</div>

          {/* Razonamiento */}
          <div className="gm-section">
            <span className="gm-section-icon">🧠</span>
            <p className="gm-section-text">{razonamiento}</p>
          </div>

          {/* Amenaza */}
          {amenaza && amenaza !== "—" && (
            <div className="gm-section">
              <span className="gm-section-icon">⚡</span>
              <p className="gm-section-text"><strong>Amenaza:</strong> {amenaza}</p>
            </div>
          )}

          {/* Plan */}
          {plan && (
            <div className="gm-section">
              <span className="gm-section-icon">🎯</span>
              <p className="gm-section-text"><strong>Plan:</strong> {plan}</p>
            </div>
          )}

          {/* Consejo de entrenamiento (solo para el jugador) */}
          {isPlayer && consejo && consejo.texto && (
            <div className="gm-consejo">
              <span className="gm-consejo-icon">{TIP_ICONS[consejo.tipo] ?? "💡"}</span>
              <span className="gm-consejo-text">{consejo.texto}</span>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

// ── Spinner de carga ──────────────────────────────────────────────────────────

const LoadingCard = () => (
  <div className="gm-loading">
    <div className="thinking-spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
    <span>Gran Maestro analizando la posición…</span>
  </div>
);

// ── Componente principal ──────────────────────────────────────────────────────

const MoveCommentary = ({ commentary, playerColor, onClose }) => {
  if (!commentary) return null;

  const { loading, player, bot, analysisMove, error } = commentary;

  // En modo análisis solo hay una jugada (sin par player+bot)
  const isSingleMove = analysisMove != null;

  if (!loading && !player && !bot && !analysisMove && !error) return null;

  return (
    <div className="gm-panel">

      {/* Cabecera del panel */}
      <div className="gm-panel-header">
        <div className="gm-panel-title">
          <span className="gm-panel-icon">🎓</span>
          <span>Análisis GM</span>
        </div>
        <button className="gm-panel-close" onClick={onClose} title="Cerrar análisis">✕</button>
      </div>

      {/* Contenido */}
      <div className="gm-panel-body">
        {loading && <LoadingCard />}

        {!loading && error && (
          <div className="gm-error">
            <span>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Error al conectar con la IA</div>
              {commentary.errorMsg && (
                <code style={{ display: "block", wordBreak: "break-all", marginBottom: 6 }}>
                  {commentary.errorMsg}
                </code>
              )}
              <span>Revisa la terminal del backend para más detalles.</span>
            </div>
          </div>
        )}

        {!loading && !error && isSingleMove && (
          <MoveCard
            data={analysisMove}
            isPlayer={analysisMove.color === (playerColor === "white" ? "white" : "black")}
            playerColor={playerColor}
          />
        )}

        {!loading && !error && !isSingleMove && (
          <>
            {player && (
              <MoveCard data={player} isPlayer={true}  playerColor={playerColor} />
            )}
            {bot && (
              <MoveCard data={bot}    isPlayer={false} playerColor={playerColor} />
            )}
          </>
        )}
      </div>

    </div>
  );
};

export default MoveCommentary;
