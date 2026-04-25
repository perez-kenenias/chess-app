/**
 * AdvantageBar.jsx — Barra vertical que muestra quién va ganando
 *
 * ¿Qué hace?
 * Recibe un número (centipawns) del backend y lo convierte en una
 * barra visual. La parte blanca crece cuando blancas van ganando,
 * la parte negra crece cuando negras van ganando.
 *
 * ¿Qué son los centipawns?
 * Es la unidad de medida de ventaja en ajedrez:
 *   +100  = blancas tienen ventaja de 1 peón
 *   -300  = negras tienen ventaja de 3 piezas
 *   +9999 = jaque mate inminente para blancas
 *
 * Props que recibe este componente (vienen de App.jsx):
 *   score  {number} — centipawns, positivo=blancas, negativo=negras
 *   mateIn {number} — si hay mate en N jugadas, si no es null
 *   height {number} — altura en px para que coincida con el tablero
 */
const AdvantageBar = ({ score = 0, mateIn = null, height = 560 }) => {

  /**
   * Convierte centipawns a porcentaje visual para la barra.
   *
   * No usamos una conversión lineal porque una ventaja de 500cp
   * no debería verse como "mitad de la barra" — se vería exagerada.
   * Usamos una curva sigmoide que hace que:
   *   0cp   → 50% (equilibrio exacto, barra al centro)
   *   +200cp → ~62% para blancas (ventaja notable)
   *   +600cp → ~80% para blancas (ventaja decisiva)
   *   mate   → 97% (casi completo)
   */
  const getWhitePercent = () => {
    if (mateIn !== null) {
      return mateIn > 0 ? 97 : 3;
    }
    if (score === null) return 50;
    const clamped = Math.max(-1000, Math.min(1000, score));
    const sigmoid = 1 / (1 + Math.exp(-clamped / 400));
    return Math.round(sigmoid * 94 + 3); // entre 3% y 97%
  };

  const whitePercent = getWhitePercent();
  const blackPercent = 100 - whitePercent;

  // Texto que se muestra: "+1.5", "-0.8", "M3", etc.
  const getEvalText = () => {
    if (mateIn !== null) return `M${Math.abs(mateIn)}`;
    if (score === null) return "0.0";
    const pawns = (Math.abs(score) / 100).toFixed(1);
    return score >= 0 ? `+${pawns}` : `-${pawns}`;
  };

  const evalText = getEvalText();
  const whiteAhead = mateIn !== null ? mateIn > 0 : (score ?? 0) >= 0;

  return (
    <div className="advantage-bar-container">
      {/* La barra es un div vertical dividido en 2 partes */}
      <div className="advantage-bar" style={{ height }}>

        {/* Parte negra — arriba, crece hacia abajo cuando negras ganan */}
        <div
          className="adv-segment adv-black"
          style={{ height: `${blackPercent}%` }}
        >
          {/* Texto de evaluación cuando negras llevan ventaja */}
          {!whiteAhead && (
            <span className="eval-text eval-black-text">{evalText}</span>
          )}
        </div>

        {/* Parte blanca — abajo, crece hacia arriba cuando blancas ganan */}
        <div
          className="adv-segment adv-white"
          style={{ height: `${whitePercent}%` }}
        >
          {/* Texto de evaluación cuando blancas llevan ventaja */}
          {whiteAhead && (
            <span className="eval-text eval-white-text">{evalText}</span>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdvantageBar;
