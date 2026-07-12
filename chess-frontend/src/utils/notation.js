/**
 * notation.js — Notación algebraica en español y glosario.
 *
 * chess.js siempre genera SAN con letras inglesas:
 *   K=King, Q=Queen, R=Rook, B=Bishop, N=Knight
 * En español las piezas son:
 *   R=Rey, D=Dama, T=Torre, A=Alfil, C=Caballo
 *
 * OJO con el conflicto: la "R" inglesa es Torre (Rook) pero la "R" española
 * es Rey. Por eso la traducción se hace SIEMPRE del SAN inglés original,
 * nunca sobre texto ya traducido.
 */

// Letra inglesa → letra española (para piezas en SAN)
const EN_TO_ES = { K: "R", Q: "D", R: "T", B: "A", N: "C" };

// Regex de un token SAN completo en un texto:
//   pieza opcional + desambiguación + captura + destino + promoción + jaque/mate
// Ejemplos que matchea: e4, exd5, Nf3, Nxf7+, Rad1, Qh4#, e8=Q, O-O, O-O-O
const SAN_TOKEN = /\b(O-O(?:-O)?|[KQRBN][a-h1-8]?x?[a-h][1-8](?:=[QRBN])?|[a-h]x?[a-h]?[1-8](?:=[QRBN])?)([+#])?(?![a-zA-Z0-9])/g;

/**
 * sanToSpanish — traduce UNA jugada SAN del inglés al español.
 *   "Nf3" → "Cf3" · "Qxf7#" → "Dxf7#" · "e8=Q" → "e8=D" · "O-O" → "O-O"
 */
export function sanToSpanish(san) {
  if (!san) return san;
  return san
    .replace(/^([KQRBN])/, (m, p) => EN_TO_ES[p])
    .replace(/=([QRBN])/, (m, p) => `=${EN_TO_ES[p]}`);
}

/**
 * formatSan — helper central: devuelve la jugada en la notación elegida.
 * Úsalo en todos los componentes que muestren jugadas.
 */
export function formatSan(san, spanish) {
  return spanish ? sanToSpanish(san) : san;
}

/**
 * translateSanInText — traduce todos los tokens SAN dentro de un texto en
 * prosa (explicaciones del análisis, comentarios de lecciones).
 *   "Había que jugar Nf3" → "Había que jugar Cf3"
 */
export function translateSanInText(text, spanish) {
  if (!spanish || !text) return text;
  return text.replace(SAN_TOKEN, (match, core, suffix = "") =>
    sanToSpanish(core) + (suffix ?? ""));
}

/** Glosario completo para el modal de ayuda. */
export const GLOSSARY = {
  piezas: [
    { en: "K", es: "R", symbol: "♔", name: "Rey (King)" },
    { en: "Q", es: "D", symbol: "♕", name: "Dama (Queen)" },
    { en: "R", es: "T", symbol: "♖", name: "Torre (Rook)" },
    { en: "B", es: "A", symbol: "♗", name: "Alfil (Bishop)" },
    { en: "N", es: "C", symbol: "♘", name: "Caballo (kNight)" },
    { en: "—", es: "—", symbol: "♙", name: "Peón — no lleva letra: 'e4' = peón a e4" },
  ],
  simbolos: [
    { sym: "x", desc: "Captura — 'Cxe5' = el caballo captura en e5" },
    { sym: "+", desc: "Jaque" },
    { sym: "#", desc: "Jaque mate" },
    { sym: "O-O", desc: "Enroque corto (flanco de rey)" },
    { sym: "O-O-O", desc: "Enroque largo (flanco de dama)" },
    { sym: "=D", desc: "Promoción — 'e8=D' = el peón corona dama" },
    { sym: "e.p.", desc: "Captura al paso (en passant)" },
  ],
  calificaciones: [
    { sym: "!!", desc: "¡¡Brillante!! — sacrificio o jugada excepcional" },
    { sym: "★", desc: "La mejor — exactamente lo que jugaría Stockfish" },
    { sym: "✦ / ✓", desc: "Excelente / Buena jugada" },
    { sym: "?!", desc: "Imprecisión — pierde algo de ventaja" },
    { sym: "?", desc: "Error — pierde ventaja importante" },
    { sym: "??", desc: "Error grave (blunder) — cambia el resultado" },
    { sym: "✗", desc: "Mate perdido — tenías mate forzado y lo dejaste ir" },
  ],
  ejemplos: [
    { en: "Nf3", es: "Cf3", desc: "Caballo a f3" },
    { en: "Bxc6", es: "Axc6", desc: "Alfil captura en c6" },
    { en: "Qh5+", es: "Dh5+", desc: "Dama a h5, jaque" },
    { en: "Rad1", es: "Tad1", desc: "Torre de la columna a va a d1" },
    { en: "exd5", es: "exd5", desc: "Peón de la columna e captura en d5" },
    { en: "e8=Q#", es: "e8=D#", desc: "Peón corona dama y da mate" },
  ],
};
