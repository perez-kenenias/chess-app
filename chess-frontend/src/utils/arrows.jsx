/**
 * arrows.js — Flechas estilo chess.com, compartidas por todos los tableros
 * (Board.jsx en Jugar, GameReview.jsx en Analizar, LearnSection.jsx en Aprender).
 *
 * Algoritmo idéntico al del mockup de diseño (Tablero.dc.html): dibuja un
 * SVG de 800x800 (8 celdas de 100 unidades) con soporte para el "codo" de
 * las jugadas de caballo, acorta el inicio para no tapar la pieza de origen,
 * y remata en una cabeza triangular sobre la casilla destino.
 */

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

/** Centro de una casilla ("e4") en el viewBox 0-800, según orientación. */
export const squareCenter = (square, orientation = "white") => {
  const file = FILES.indexOf(square[0]);
  const rank = 8 - parseInt(square[1], 10);
  const flipped = orientation === "black";
  const col = flipped ? 7 - file : file;
  const row = flipped ? 7 - rank : rank;
  return [col * 100 + 50, row * 100 + 50];
};

/** Convierte [{from,to,color?,opacity?}] en formas SVG listas para renderizar. */
export const buildArrowShapes = (arrows, orientation = "white") => {
  const shapes = [];
  (arrows || []).forEach((a, ai) => {
    if (!a || !a.from || !a.to) return;
    const [sx, sy] = squareCenter(a.from, orientation);
    const [ex, ey] = squareCenter(a.to, orientation);
    const dx = ex - sx, dy = ey - sy;
    const knight = (Math.abs(dx) === 100 && Math.abs(dy) === 200) || (Math.abs(dx) === 200 && Math.abs(dy) === 100);
    let cx = sx, cy = sy;
    if (knight) { if (Math.abs(dx) > Math.abs(dy)) { cx = ex; cy = sy; } else { cx = sx; cy = ey; } }
    const d1x = (knight ? cx : ex) - sx, d1y = (knight ? cy : ey) - sy;
    const l1 = Math.hypot(d1x, d1y) || 1;
    const stx = sx + (d1x / l1) * 36, sty = sy + (d1y / l1) * 36;
    const lsx = knight ? cx : stx, lsy = knight ? cy : sty;
    const d2x = ex - lsx, d2y = ey - lsy;
    const l2 = Math.hypot(d2x, d2y) || 1;
    const ux = d2x / l2, uy = d2y / l2;
    const headLen = 34, halfW = 27;
    const bx = ex - ux * headLen, by = ey - uy * headLen;
    const px = -uy, py = ux;
    let d = `M ${stx} ${sty}`;
    if (knight) d += ` L ${cx} ${cy}`;
    d += ` L ${bx} ${by}`;
    const col = a.color || "#81b64c";
    const opacity = a.opacity ?? 0.85;
    shapes.push({ type: "line", key: "a" + ai, d, color: col, opacity });
    shapes.push({
      type: "head", key: "h" + ai, color: col, opacity,
      points: `${ex},${ey} ${bx + px * halfW},${by + py * halfW} ${bx - px * halfW},${by - py * halfW}`,
    });
  });
  return shapes;
};

/**
 * ArrowLayer — capa SVG absoluta lista para poner encima de un <Chessboard>.
 * El contenedor padre debe tener position:relative.
 */
export const ArrowLayer = ({ arrows, orientation = "white", zIndex = 6 }) => {
  const shapes = buildArrowShapes(arrows, orientation);
  if (shapes.length === 0) return null;
  return (
    <svg
      viewBox="0 0 800 800"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex }}
    >
      {shapes.map((s) =>
        s.type === "line" ? (
          <path key={s.key} d={s.d} stroke={s.color} strokeWidth={21} fill="none"
                strokeLinejoin="round" strokeLinecap="butt" opacity={s.opacity} />
        ) : (
          <polygon key={s.key} points={s.points} fill={s.color} opacity={s.opacity} />
        )
      )}
    </svg>
  );
};
