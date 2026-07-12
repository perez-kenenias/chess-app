/**
 * EvalGraph.jsx — Gráfica de evaluación de la partida (como en chess.com).
 *
 * Dibuja un área SVG con la evaluación de cada jugada: por encima del eje
 * central ventaja blanca (zona clara), por debajo ventaja negra (zona oscura).
 * Clic en cualquier punto → salta a esa jugada. Marca errores con puntos.
 */

const CLASS_COLORS = {
  brilliant: "#26c2a3",
  best: "#81b64c",
  excellent: "#81b64c",
  good: "#95b776",
  forced: "#97af8b",
  inaccuracy: "#f0c15c",
  mistake: "#e58f2a",
  miss: "#e02828",
  blunder: "#ca3431",
};

// Comprime la eval (cp) a [-1, 1] con una curva suave — así un +12 no aplasta
// visualmente la zona interesante de ±3 peones.
function squash(cp) {
  const capped = Math.max(-1200, Math.min(1200, cp));
  return Math.tanh(capped / 400);
}

export default function EvalGraph({ analysis, currentPly, onSelectPly }) {
  if (!analysis || analysis.length === 0) return null;

  const W = 560, H = 120, PAD = 4;
  const midY = H / 2;
  const n = analysis.length;
  const xFor = (i) => PAD + (i / Math.max(1, n - 1)) * (W - PAD * 2);
  const yFor = (cp) => midY - squash(cp) * (midY - PAD);

  // Polígono del área: empieza en eval 0, recorre los evals, cierra por el eje
  let path = `M ${xFor(0)} ${yFor(analysis[0].eval_before ?? 0)}`;
  analysis.forEach((m, i) => { path += ` L ${xFor(i)} ${yFor(m.eval_after)}`; });
  const area = path + ` L ${xFor(n - 1)} ${midY} L ${xFor(0)} ${midY} Z`;

  // Puntos de errores relevantes (imprecisión en adelante)
  const marks = analysis
    .map((m, i) => ({ ...m, i }))
    .filter(m => ["inaccuracy", "mistake", "blunder", "miss", "brilliant"].includes(m.classification?.key));

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const ply = Math.round(((x - PAD) / (W - PAD * 2)) * (n - 1));
    onSelectPly(Math.max(0, Math.min(n - 1, ply)));
  };

  return (
    <svg
      className="eval-graph"
      viewBox={`0 0 ${W} ${H}`}
      onClick={handleClick}
      role="img"
      aria-label="Gráfica de evaluación de la partida"
    >
      {/* Fondo: mitad superior blanca-ish, inferior oscura */}
      <rect x="0" y="0" width={W} height={midY} fill="#9a9a9a" opacity="0.25" />
      <rect x="0" y={midY} width={W} height={midY} fill="#1b1b1b" opacity="0.55" />

      {/* Área de ventaja blanca */}
      <path d={area} fill="#f0f0f0" opacity="0.85" />
      <path d={path.replace("M", "M")} fill="none" stroke="#7fa650" strokeWidth="1.5" />

      {/* Eje central */}
      <line x1="0" y1={midY} x2={W} y2={midY} stroke="#666" strokeWidth="0.7" />

      {/* Marcas de errores / brillantes */}
      {marks.map(m => (
        <circle
          key={m.i}
          cx={xFor(m.i)}
          cy={yFor(m.eval_after)}
          r="3.5"
          fill={CLASS_COLORS[m.classification.key] || "#999"}
          stroke="#222"
          strokeWidth="0.8"
        />
      ))}

      {/* Cursor de jugada actual */}
      {currentPly >= 0 && currentPly < n && (
        <line
          x1={xFor(currentPly)} y1="0"
          x2={xFor(currentPly)} y2={H}
          stroke="#f8c33a" strokeWidth="1.5" opacity="0.9"
        />
      )}
    </svg>
  );
}
