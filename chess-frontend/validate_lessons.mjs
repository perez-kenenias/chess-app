import { Chess } from "chess.js";
import { LESSONS } from "./src/data/lessons.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
let total = 0, passed = 0, failed = [];

for (const cat of Object.keys(LESSONS)) {
  for (const lesson of LESSONS[cat]) {
    total++;
    try {
      const c = new Chess(lesson.initialFen || START_FEN);
      for (const mv of lesson.moves) {
        const r = c.move(mv.san);
        if (!r) throw new Error(`Jugada ilegal: ${mv.san}`);
      }
      passed++;
    } catch (e) {
      failed.push(`[${cat}] ${lesson.id}: ${e.message}`);
    }
  }
}
console.log(`Total: ${total}, OK: ${passed}, FALLOS: ${failed.length}`);
failed.forEach(f => console.log(f));
for (const cat of Object.keys(LESSONS)) console.log(`${cat}: ${LESSONS[cat].length}`);
