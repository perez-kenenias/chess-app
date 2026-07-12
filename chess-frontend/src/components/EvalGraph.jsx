/**
 * EvalGraph.jsx — Gráfica de evaluación de la partida (como en chess.com),
 * en versión "amigable": con etiquetas de quién va ganando, líneas de
 * referencia (+1 / +3 peones), tooltip al pasar el cursor y leyenda que
 * explica qué significa cada punto de color.
 *
 * Cómo leerla:
 *   - El eje central = igualdad (0.0).
 *   - Cuanto más SUBE el área clara, mayor ventaja de las BLANCAS.
 *   - Cuanto más BAJA, mayor ventaja de las NEGRAS.
 *   - La escala está en "peones": +1 ≈ ir un peón arriba, +3 ≈ una pieza menor.
 *   - Clic en cualquier punto → salta a esa jugada.
 */

import { useState } from "react";
import { formatSan } from "../utils/notation";

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

// Leyenda de los puntos que se dibujan sobre la curva
const LEGEND = [
  { key: "brilliant",  label: "Brillante" },
  { key: "inaccuracy", label: "Imprecisión" },
  { key: "mistake",    label: "Error" },
  { key: "blunder",    label: "Error grave" },
];

// Comprime la eval (cp) a [-1, 1] con una curva suave — así un +12 no aplasta
// visualmente la zona interesante de ±3 peones.
function squash(cp) {
  const capped = Math.max(-1200, Math.min(1200, cp));
  return Math.tanh(capped / 400);
}

/** Texto humano de la evaluación: "+1.2 · mejor Blancas", "Mate en 3", etc. */
function humanEval(m) {
  if (m.mate_after != null) {
    const side = m.mate_after > 0 ? "Blancas" : "Negras";
    return `Mate en ${Math.abs(m.mate_after)} a favor de ${side}`;
  }
  const pawns = m.eval_after / 100;
  if (Math.abs(pawns) < 0.3) return "±0.0 · igualdad";
  const side = pawns > 0 ? "Blancas" : "Negras";
  const val  = Math.abs(pawns).toFixed(1);
  let size;
  if (Math.abs(pawns) >= 3)      size = "ventaja decisiva";
  else if (Math.abs(pawns) >= 1) size = "ventaja clara";
  else                           size = "ligera ventaja";
  return `${pawns > 0 ? "+" : "-"}${val} · ${size} de ${side}`;
}

export default function EvalGraph({ analysis, currentPly, onSelectPly, esNotation = false }) {
  const [hoverPly, setHoverPly] = useState(null);

  if (!analysis || analysis.length === 0) return null;

  const W = 560, H = 140, PAD = 4;
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

  const plyFromEvent = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const ply = Math.round(((x - PAD) / (W - PAD * 2)) * (n - 1));
    return Math.max(0, Math.min(n - 1, ply));
  };

  const handleClick = (e) => onSelectPly(plyFromEvent(e));
  const handleMove  = (e) => setHoverPly(plyFromEvent(e));

  // Datos de la jugada bajo el cursor (o, si no hay hover, la jugada actual)
  const infoPly  = hoverPly ?? (currentPly >= 0 && currentPly < n ? currentPly : null);
  const infoMove = infoPly != null ? analysis[infoPly] : null;

  // Líneas de referencia: +1 / +3 peones para cada lado
  const refLines = [
    { cp:  300, label: "+3" },
    { cp:  100, label: "+1" },
    { cp: -100, label: "-1" },
    { cp: -300, label: "-3" },
  ];

  return (
    <div className="eval-graph-wrap">

      {/* Cabecera con etiqueta de lectura rápida */}
      <div className="eval-graph-header">
        <span className="eval-graph-title">📈 ¿Quién va ganando?</span>
        <span className="eval-graph-hint">clic en la gráfica = saltar a esa jugada</span>
      </div>

      <div className="eval-graph-sides">
        <span className="eval-side-label">♔ Zona de Blancas — cuanto más sube el área clara, mayor su ventaja</span>
      </div>

      <svg
        className="eval-graph"
        viewBox={`0 0 ${W} ${H}`}
        onClick={handleClick}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverPly(null)}
        role="img"
        aria-label="Gráfica de evaluación de la partida: área por encima del centro = ventaja de blancas, por debajo = ventaja de negras"
      >
        {/* Fondo: mitad superior blanca-ish (zona Blancas), inferior oscura (zona Negras) */}
        <rect x="0" y="0" width={W} height={midY} fill="#9a9a9a" opacity="0.25" />
        <rect x="0" y={midY} width={W} height={midY} fill="#1b1b1b" opacity="0.55" />

        {/* Líneas de referencia (escala en peones) */}
        {refLines.map(r => (
          <g key={r.cp}>
            <line
              x1="0" y1={yFor(r.cp)} x2={W} y2={yFor(r.cp)}
              stroke="#888" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.5"
            />
            <text
              x={W - 6} y={yFor(r.cp) + (r.cp > 0 ? -2.5 : 9)}
              fontSize="8.5" fill="#aaa" textAnchor="end"
            >{r.label} {Math.abs(r.cp) === 100 ? "peón" : "peones"}</text>
          </g>
        ))}

        {/* Área de ventaja blanca */}
        <path d={area} fill="#f0f0f0" opacity="0.85" />
        <path d={path} fill="none" stroke="#7fa650" strokeWidth="1.5" />

        {/* Eje central = igualdad */}
        <line x1="0" y1={midY} x2={W} y2={midY} stroke="#666" strokeWidth="0.7" />
        <text x="6" y={midY - 3} fontSize="8.5" fill="#999">0.0 = igualdad</text>

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

        {/* Línea de hover (previa al clic) */}
        {hoverPly != null && hoverPly !== currentPly && (
          <line
            x1={xFor(hoverPly)} y1="0"
            x2={xFor(hoverPly)} y2={H}
            stroke="#fff" strokeWidth="1" opacity="0.35"
          />
        )}

        {/* Cursor de jugada actual */}
        {currentPly >= 0 && currentPly < n && (
          <line
            x1={xFor(currentPly)} y1="0"
            x2={xFor(currentPly)} y2={H}
            stroke="#f8c33a" strokeWidth="1.5" opacity="0.9"
          />
        )}
      </svg>

      <div className="eval-graph-sides">
        <span className="eval-side-label">♚ Zona de Negras — cuanto más baja el área, mayor su ventaja</span>
      </div>

      {/* Info de la jugada bajo el cursor / actual */}
      <div className="eval-graph-info">
        {infoMove ? (
          <>
            <b>
              Jugada {Math.floor(infoPly / 2) + 1}{infoPly % 2 === 0 ? "." : "..."}{" "}
              {formatSan(infoMove.san, esNotation)}
            </b>
            {infoMove.classification && (
              <span
                className="eval-info-class"
                style={{ color: CLASS_COLORS[infoMove.classification.key] || "#999" }}
              >
                {infoMove.classification.icon} {infoMove.classification.label}
              </span>
            )}
            <span className="eval-info-eval">→ {humanEval(infoMove)}</span>
          </>
        ) : (
          <span className="eval-info-placeholder">
            Pasa el cursor por la gráfica para ver el detalle de cada jugada.
          </span>
        )}
      </div>

      {/* Leyenda de los puntos */}
      <div className="eval-graph-legend">
        {LEGEND.map(l => (
          <span key={l.key} className="eval-legend-item">
            <span className="eval-legend-dot" style={{ background: CLASS_COLORS[l.key] }} />
            {l.label}
          </span>
        ))}
        <span className="eval-legend-item">
          <span className="eval-legend-dot eval-legend-line" />
          Jugada actual
        </span>
      </div>
    </div>
  );
}
