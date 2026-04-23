/**
 * MoveAnalysisCard.jsx — Tarjeta de análisis de tu última jugada
 *
 * Se muestra en la columna derecha (entre el panel de control y el historial)
 * cuando el jugador hizo una jugada diferente a la que Stockfish prefería.
 *
 * Features:
 *   · Clasificación del error: Jugable / Imprecisión / Error / Error grave
 *   · Comparación clara: jugada del jugador vs. jugada óptima
 *   · Razonamiento posicional: por qué la posición resultante es diferente
 *   · Pasa el ratón para resaltar en el tablero las casillas de la jugada óptima
 *   · Botón de cerrar para descartar el análisis
 *
 * Props:
 *   info        {object|null} — datos del análisis (viene de getWrongMoveAnalysis)
 *   onClose     {Function}   — cierra / descarta la tarjeta
 *   onHighlight {Function}   — callback para resaltar jugada en el tablero
 */

const MoveAnalysisCard = ({ info, onClose, onHighlight }) => {
  if (!info) return null;

  const {
    playedSan, suggestedSan,
    playedPieceName, playedToSq,
    suggestedPiece, suggestedFrom, suggestedTo,
    blunder, positionalContext,
  } = info;

  return (
    <div className="move-analysis-card">

      {/* Cabecera con clasificación y botón cerrar */}
      <div className="mac-header">
        <div className="mac-title-row">
          <span className="mac-icon">🔍</span>
          <span className="mac-title">Análisis de tu última jugada</span>
        </div>
        <div className="mac-right">
          <span className="mac-blunder-badge" style={{ color: blunder.color, borderColor: blunder.color }}>
            {blunder.text}
          </span>
          <button className="mac-close" onClick={onClose} title="Descartar análisis">✕</button>
        </div>
      </div>

      {/* Comparación: jugada del jugador vs. jugada óptima */}
      <div className="mac-comparison">
        {/* Lo que jugaste */}
        <div className="mac-move mac-move--played">
          <span className="mac-move-label">Jugaste</span>
          <span className="mac-move-san mac-move-san--played">{playedSan}</span>
          {playedPieceName && playedToSq && (
            <span className="mac-move-detail">{playedPieceName} → {playedToSq}</span>
          )}
        </div>

        <span className="mac-vs">vs</span>

        {/* Lo que era mejor — hover resalta en el tablero */}
        <div
          className="mac-move mac-move--suggested"
          onMouseEnter={() => onHighlight?.({ from_square: suggestedFrom, to_square: suggestedTo })}
          onMouseLeave={() => onHighlight?.(null)}
          title="Pasa el cursor para ver esta jugada en el tablero"
        >
          <span className="mac-move-label">Stockfish prefería</span>
          <span className="mac-move-san mac-move-san--suggested">{suggestedSan}</span>
          {suggestedPiece && suggestedTo && (
            <span className="mac-move-detail">{suggestedPiece} → {suggestedTo}</span>
          )}
          <span className="mac-hover-hint">🖱 ver en tablero</span>
        </div>
      </div>

      {/* Razonamiento posicional */}
      {positionalContext && (
        <div className="mac-context">
          <p>{positionalContext}</p>
        </div>
      )}

    </div>
  );
};

export default MoveAnalysisCard;
