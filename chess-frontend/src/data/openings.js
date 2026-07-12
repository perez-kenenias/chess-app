/**
 * openings.js — Base de datos de aperturas (subconjunto ECO).
 *
 * Cada entrada: { eco, name, moves } donde moves es la secuencia SAN
 * separada por espacios desde la posición inicial.
 *
 * detectOpening(sanMoves) busca la coincidencia de PREFIJO MÁS LARGA:
 * mientras juegas, la apertura detectada se va refinando (Apertura de peón
 * de rey → Apertura Italiana → Giuoco Piano) igual que en chess.com.
 */

export const OPENINGS = [
  // ── Aperturas de peón de rey (1.e4) ──────────────────────────────────────
  { eco: "B00", name: "Apertura de peón de rey", moves: "e4" },
  { eco: "C20", name: "Apertura abierta", moves: "e4 e5" },
  { eco: "C40", name: "Apertura de caballo de rey", moves: "e4 e5 Nf3" },
  { eco: "C44", name: "Juego abierto", moves: "e4 e5 Nf3 Nc6" },

  { eco: "C50", name: "Apertura Italiana", moves: "e4 e5 Nf3 Nc6 Bc4" },
  { eco: "C50", name: "Italiana: Giuoco Pianissimo", moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 d3" },
  { eco: "C53", name: "Italiana: Giuoco Piano", moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3" },
  { eco: "C51", name: "Gambito Evans", moves: "e4 e5 Nf3 Nc6 Bc4 Bc5 b4" },
  { eco: "C55", name: "Defensa de los Dos Caballos", moves: "e4 e5 Nf3 Nc6 Bc4 Nf6" },
  { eco: "C57", name: "Dos Caballos: Ataque Fried Liver", moves: "e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7" },

  { eco: "C60", name: "Apertura Española (Ruy López)", moves: "e4 e5 Nf3 Nc6 Bb5" },
  { eco: "C65", name: "Española: Defensa Berlinesa", moves: "e4 e5 Nf3 Nc6 Bb5 Nf6" },
  { eco: "C68", name: "Española: Variante del Cambio", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Bxc6" },
  { eco: "C70", name: "Española: Variante Morphy", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4" },
  { eco: "C78", name: "Española: Arcángel", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O b5" },
  { eco: "C84", name: "Española: Cerrada", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7" },
  { eco: "C89", name: "Española: Ataque Marshall", moves: "e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c3 d5" },

  { eco: "C42", name: "Defensa Petrov (Rusa)", moves: "e4 e5 Nf3 Nf6" },
  { eco: "C45", name: "Apertura Escocesa", moves: "e4 e5 Nf3 Nc6 d4" },
  { eco: "C45", name: "Escocesa: línea principal", moves: "e4 e5 Nf3 Nc6 d4 exd4 Nxd4" },
  { eco: "C25", name: "Apertura Vienesa", moves: "e4 e5 Nc3" },
  { eco: "C30", name: "Gambito de Rey", moves: "e4 e5 f4" },
  { eco: "C33", name: "Gambito de Rey Aceptado", moves: "e4 e5 f4 exf4" },
  { eco: "C36", name: "Gambito de Rey: Defensa Moderna", moves: "e4 e5 f4 exf4 Nf3 d5" },
  { eco: "C21", name: "Gambito Danés", moves: "e4 e5 d4 exd4 c3" },
  { eco: "C23", name: "Apertura de Alfil", moves: "e4 e5 Bc4" },
  { eco: "C46", name: "Apertura de los Tres Caballos", moves: "e4 e5 Nf3 Nc6 Nc3" },
  { eco: "C47", name: "Apertura de los Cuatro Caballos", moves: "e4 e5 Nf3 Nc6 Nc3 Nf6" },
  { eco: "C41", name: "Defensa Philidor", moves: "e4 e5 Nf3 d6" },
  { eco: "C20", name: "Apertura Portuguesa", moves: "e4 e5 Bb5" },
  { eco: "C20", name: "Ataque Wayward Queen", moves: "e4 e5 Qh5" },

  // ── Defensa Siciliana ────────────────────────────────────────────────────
  { eco: "B20", name: "Defensa Siciliana", moves: "e4 c5" },
  { eco: "B21", name: "Siciliana: Ataque Grand Prix", moves: "e4 c5 Nc3 Nc6 f4" },
  { eco: "B22", name: "Siciliana: Variante Alapin", moves: "e4 c5 c3" },
  { eco: "B23", name: "Siciliana Cerrada", moves: "e4 c5 Nc3" },
  { eco: "B27", name: "Siciliana: línea abierta", moves: "e4 c5 Nf3" },
  { eco: "B30", name: "Siciliana: Antigua", moves: "e4 c5 Nf3 Nc6" },
  { eco: "B31", name: "Siciliana: Rossolimo", moves: "e4 c5 Nf3 Nc6 Bb5" },
  { eco: "B40", name: "Siciliana: variante e6", moves: "e4 c5 Nf3 e6" },
  { eco: "B50", name: "Siciliana: variante d6", moves: "e4 c5 Nf3 d6" },
  { eco: "B51", name: "Siciliana: Ataque Moscú", moves: "e4 c5 Nf3 d6 Bb5+" },
  { eco: "B54", name: "Siciliana Abierta", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4" },
  { eco: "B70", name: "Siciliana: Variante del Dragón", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6" },
  { eco: "B80", name: "Siciliana: Scheveningen", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 e6" },
  { eco: "B90", name: "Siciliana: Najdorf", moves: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6" },
  { eco: "B33", name: "Siciliana: Sveshnikov", moves: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5" },
  { eco: "B36", name: "Siciliana: Maroczy", moves: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 g6 c4" },

  // ── Otras defensas contra 1.e4 ───────────────────────────────────────────
  { eco: "C00", name: "Defensa Francesa", moves: "e4 e6" },
  { eco: "C02", name: "Francesa: Variante del Avance", moves: "e4 e6 d4 d5 e5" },
  { eco: "C03", name: "Francesa: Variante Tarrasch", moves: "e4 e6 d4 d5 Nd2" },
  { eco: "C10", name: "Francesa: línea principal", moves: "e4 e6 d4 d5 Nc3" },
  { eco: "C15", name: "Francesa: Winawer", moves: "e4 e6 d4 d5 Nc3 Bb4" },
  { eco: "C11", name: "Francesa: Clásica", moves: "e4 e6 d4 d5 Nc3 Nf6" },

  { eco: "B10", name: "Defensa Caro-Kann", moves: "e4 c6" },
  { eco: "B12", name: "Caro-Kann: Variante del Avance", moves: "e4 c6 d4 d5 e5" },
  { eco: "B13", name: "Caro-Kann: Variante del Cambio", moves: "e4 c6 d4 d5 exd5 cxd5" },
  { eco: "B15", name: "Caro-Kann: línea principal", moves: "e4 c6 d4 d5 Nc3" },
  { eco: "B18", name: "Caro-Kann: Clásica", moves: "e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5" },

  { eco: "B01", name: "Defensa Escandinava", moves: "e4 d5" },
  { eco: "B01", name: "Escandinava: dama a a5", moves: "e4 d5 exd5 Qxd5 Nc3 Qa5" },
  { eco: "B02", name: "Defensa Alekhine", moves: "e4 Nf6" },
  { eco: "B06", name: "Defensa Moderna", moves: "e4 g6" },
  { eco: "B07", name: "Defensa Pirc", moves: "e4 d6 d4 Nf6" },
  { eco: "C46", name: "Defensa Nimzowitsch", moves: "e4 Nc6" },

  // ── Aperturas de peón de dama (1.d4) ─────────────────────────────────────
  { eco: "A40", name: "Apertura de peón de dama", moves: "d4" },
  { eco: "D00", name: "Juego de peón de dama", moves: "d4 d5" },
  { eco: "D02", name: "Sistema Londres", moves: "d4 d5 Nf3 Nf6 Bf4" },
  { eco: "D00", name: "Sistema Londres (orden moderno)", moves: "d4 Nf6 Bf4" },
  { eco: "D00", name: "Ataque Trompowsky", moves: "d4 Nf6 Bg5" },
  { eco: "D01", name: "Ataque Richter-Veresov", moves: "d4 d5 Nc3 Nf6 Bg5" },
  { eco: "D00", name: "Ataque Stonewall", moves: "d4 d5 e3 Nf6 Bd3" },

  { eco: "D06", name: "Gambito de Dama", moves: "d4 d5 c4" },
  { eco: "D20", name: "Gambito de Dama Aceptado", moves: "d4 d5 c4 dxc4" },
  { eco: "D30", name: "Gambito de Dama Rehusado", moves: "d4 d5 c4 e6" },
  { eco: "D35", name: "GDR: Variante del Cambio", moves: "d4 d5 c4 e6 Nc3 Nf6 cxd5 exd5" },
  { eco: "D37", name: "GDR: línea principal", moves: "d4 d5 c4 e6 Nc3 Nf6 Nf3" },
  { eco: "D10", name: "Defensa Eslava", moves: "d4 d5 c4 c6" },
  { eco: "D15", name: "Eslava: línea principal", moves: "d4 d5 c4 c6 Nf3 Nf6 Nc3" },
  { eco: "D43", name: "Semi-Eslava", moves: "d4 d5 c4 c6 Nf3 Nf6 Nc3 e6" },
  { eco: "D08", name: "Contragambito Albin", moves: "d4 d5 c4 e5" },
  { eco: "D07", name: "Defensa Chigorin", moves: "d4 d5 c4 Nc6" },

  { eco: "E00", name: "Defensa India", moves: "d4 Nf6" },
  { eco: "E60", name: "Defensa India de Rey", moves: "d4 Nf6 c4 g6" },
  { eco: "E70", name: "India de Rey: línea principal", moves: "d4 Nf6 c4 g6 Nc3 Bg7 e4 d6" },
  { eco: "E20", name: "Defensa Nimzo-India", moves: "d4 Nf6 c4 e6 Nc3 Bb4" },
  { eco: "E12", name: "Defensa India de Dama", moves: "d4 Nf6 c4 e6 Nf3 b6" },
  { eco: "A50", name: "Defensa Grünfeld", moves: "d4 Nf6 c4 g6 Nc3 d5" },
  { eco: "E10", name: "Defensa Bogo-India", moves: "d4 Nf6 c4 e6 Nf3 Bb4+" },
  { eco: "A43", name: "Defensa Benoni", moves: "d4 Nf6 c4 c5 d5" },
  { eco: "A57", name: "Gambito Benko", moves: "d4 Nf6 c4 c5 d5 b5" },
  { eco: "A80", name: "Defensa Holandesa", moves: "d4 f5" },
  { eco: "A90", name: "Holandesa: Stonewall", moves: "d4 f5 c4 Nf6 g3 e6 Bg2 d5" },
  { eco: "D80", name: "Gambito Blackmar-Diemer", moves: "d4 d5 e4" },

  // ── Aperturas de flanco ──────────────────────────────────────────────────
  { eco: "A04", name: "Apertura Réti", moves: "Nf3" },
  { eco: "A07", name: "Réti: Ataque Indio de Rey", moves: "Nf3 d5 g3" },
  { eco: "A10", name: "Apertura Inglesa", moves: "c4" },
  { eco: "A20", name: "Inglesa: variante e5", moves: "c4 e5" },
  { eco: "A30", name: "Inglesa: Simétrica", moves: "c4 c5" },
  { eco: "A01", name: "Apertura Larsen", moves: "b3" },
  { eco: "A00", name: "Apertura Bird", moves: "f4" },
  { eco: "A00", name: "Apertura Grob", moves: "g4" },
  { eco: "A00", name: "Apertura Polaca (Orangután)", moves: "b4" },
  { eco: "A00", name: "Ataque Indio de Rey", moves: "Nf3 Nf6 g3" },
  { eco: "A00", name: "Apertura Van Geet", moves: "Nc3" },
];

/**
 * detectOpening — dado el historial de jugadas en SAN, devuelve la apertura
 * con el prefijo coincidente más largo, o null si nada coincide.
 *
 * @param {string[]} sanMoves — ej: ["e4", "e5", "Nf3", "Nc6", "Bc4"]
 * @returns {{eco, name, moves, matchedPlies} | null}
 */
export function detectOpening(sanMoves) {
  if (!sanMoves || sanMoves.length === 0) return null;
  let best = null;
  for (const opening of OPENINGS) {
    const openingMoves = opening.moves.split(" ");
    if (openingMoves.length > sanMoves.length) continue;
    let matches = true;
    for (let i = 0; i < openingMoves.length; i++) {
      if (openingMoves[i] !== sanMoves[i]) { matches = false; break; }
    }
    if (matches && (!best || openingMoves.length > best.matchedPlies)) {
      best = { ...opening, matchedPlies: openingMoves.length };
    }
  }
  return best;
}
