import { Chess } from "chess.js";
const fen = process.argv[2];
const moves = process.argv.slice(3);
const c = new Chess(fen && fen !== "-" ? fen : undefined);
for (const m of moves) {
  const r = c.move(m);
  if (!r) { console.log("ILLEGAL:", m, "at", c.fen()); process.exit(1); }
}
console.log("FEN now:", c.fen());
console.log("Turn:", c.turn());
console.log("In check:", c.inCheck());
console.log("Legal moves:", c.moves({verbose:false}).join(" "));
