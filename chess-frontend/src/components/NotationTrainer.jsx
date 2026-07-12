/**
 * NotationTrainer.jsx — Quiz para memorizar la notación algebraica.
 *
 * Mecánica:
 *   1. Se genera una posición aleatoria (jugadas legales al azar desde el inicio)
 *   2. Se elige una jugada legal y se muestra en el tablero (origen → destino)
 *   3. El usuario elige entre 4 notaciones posibles cuál describe esa jugada
 *   4. Feedback inmediato con explicación + racha de aciertos
 *
 * ¿Por qué distractores de la misma posición?
 * Todas las opciones son jugadas LEGALES de la posición actual — así el
 * usuario no puede descartar por intuición ("esa pieza ni está") y de paso
 * lee cuatro notaciones reales por pregunta: práctica ×4.
 */

import { useState, useCallback, useMemo } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { formatSan } from "../utils/notation";

const PIECE_NAMES = {
  p: "peón", n: "caballo", b: "alfil", r: "torre", q: "dama", k: "rey",
};

/** Baraja un array (Fisher-Yates) sin mutar el original. */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Genera una pregunta: posición aleatoria + jugada a identificar + 3 distractores. */
function generateQuestion() {
  // Posición aleatoria: entre 2 y 30 medias jugadas al azar.
  // Si la partida muere antes (mate/tablas), se reintenta con menos jugadas.
  for (let attempt = 0; attempt < 10; attempt++) {
    const chess = new Chess();
    const target = 2 + Math.floor(Math.random() * 29);
    for (let i = 0; i < target && !chess.isGameOver(); i++) {
      const moves = chess.moves();
      chess.move(moves[Math.floor(Math.random() * moves.length)]);
    }
    const legal = chess.moves({ verbose: true });
    if (legal.length < 4) continue; // necesitamos 4 opciones distintas

    const pick = legal[Math.floor(Math.random() * legal.length)];
    const distractors = shuffle(legal.filter(m => m.san !== pick.san))
      .slice(0, 3)
      .map(m => m.san);

    return {
      fen: chess.fen(),
      turn: chess.turn() === "w" ? "white" : "black",
      answer: pick.san,
      from: pick.from,
      to: pick.to,
      piece: pick.piece,
      captured: pick.captured ?? null,
      isCheck: pick.san.includes("+"),
      isMate: pick.san.includes("#"),
      isCastle: pick.san.startsWith("O-O"),
      options: shuffle([pick.san, ...distractors]),
    };
  }
  return null; // extremadamente improbable
}

/** Explica en español por qué la respuesta se escribe así. */
function explain(q) {
  if (q.isCastle) {
    return q.answer.startsWith("O-O-O")
      ? "Enroque largo: el rey y la torre de dama. Siempre se escribe O-O-O."
      : "Enroque corto: el rey y la torre de rey. Siempre se escribe O-O.";
  }
  const partes = [];
  if (q.piece === "p") {
    partes.push(q.captured
      ? `Es un PEÓN capturando: se escribe la columna de origen (${q.from[0]}), la x y el destino (${q.to}).`
      : `Es un PEÓN: no lleva letra, solo la casilla destino (${q.to}).`);
  } else {
    partes.push(`Mueve ${PIECE_NAMES[q.piece]} (${q.from} → ${q.to}): letra de la pieza + ${q.captured ? "x de captura + " : ""}casilla destino.`);
    if (q.captured) partes.push(`Captura ${PIECE_NAMES[q.captured]}.`);
  }
  if (q.isMate) partes.push("El # final indica jaque MATE.");
  else if (q.isCheck) partes.push("El + final indica que da jaque.");
  return partes.join(" ");
}

export default function NotationTrainer({ esNotation = false }) {
  const [question, setQuestion] = useState(() => generateQuestion());
  const [selected, setSelected] = useState(null); // SAN elegido (null = sin responder)
  const [streak, setStreak]     = useState(0);
  const [best, setBest]         = useState(() => Number(localStorage.getItem("notationBest") ?? 0));
  const [total, setTotal]       = useState(0);
  const [hits, setHits]         = useState(0);

  const next = useCallback(() => {
    setQuestion(generateQuestion());
    setSelected(null);
  }, []);

  const choose = useCallback((san) => {
    if (selected !== null) return; // ya respondió
    setSelected(san);
    setTotal(t => t + 1);
    if (san === question.answer) {
      setHits(h => h + 1);
      setStreak(s => {
        const ns = s + 1;
        setBest(b => {
          const nb = Math.max(b, ns);
          localStorage.setItem("notationBest", String(nb));
          return nb;
        });
        return ns;
      });
    } else {
      setStreak(0);
    }
  }, [selected, question]);

  const squareStyles = useMemo(() => {
    if (!question) return {};
    return {
      [question.from]: { backgroundColor: "rgba(96, 165, 250, 0.5)" },
      [question.to]:   { backgroundColor: "rgba(96, 165, 250, 0.8)" },
    };
  }, [question]);

  if (!question) return <div className="boundary-fallback"><p>No se pudo generar pregunta.</p></div>;

  const answered = selected !== null;
  const correct  = selected === question.answer;

  return (
    <div className="trainer-layout">
      <div className="trainer-board-col">
        <div className="trainer-question">
          <span className="trainer-turn">
            {question.turn === "white" ? "♔ Mueven blancas" : "♚ Mueven negras"}
          </span>
          <span className="trainer-prompt">
            La jugada resaltada ({question.from} → {question.to})... ¿cómo se escribe?
          </span>
        </div>

        <Chessboard
          options={{
            id: "board-trainer", // único: evita colisión de ids con otros tableros montados
            position: question.fen,
            boardOrientation: question.turn,
            squareStyles,
            canDragPiece: () => false,
            animationDurationInMs: 0,
            showNotation: true,
          }}
        />
      </div>

      <div className="trainer-side-col">
        <div className="trainer-score">
          <div className="trainer-stat">
            <span className="trainer-stat-value">🔥 {streak}</span>
            <span className="trainer-stat-label">racha</span>
          </div>
          <div className="trainer-stat">
            <span className="trainer-stat-value">🏆 {best}</span>
            <span className="trainer-stat-label">récord</span>
          </div>
          <div className="trainer-stat">
            <span className="trainer-stat-value">{total > 0 ? Math.round((hits / total) * 100) : 0}%</span>
            <span className="trainer-stat-label">{hits}/{total} aciertos</span>
          </div>
        </div>

        <div className="trainer-options">
          {question.options.map((san) => {
            let cls = "trainer-option";
            if (answered) {
              if (san === question.answer) cls += " correct";
              else if (san === selected)   cls += " wrong";
              else                         cls += " dimmed";
            }
            return (
              <button key={san} className={cls} onClick={() => choose(san)} disabled={answered}>
                {formatSan(san, esNotation)}
              </button>
            );
          })}
        </div>

        {answered && (
          <div className={`trainer-feedback ${correct ? "ok" : "fail"}`}>
            <div className="trainer-feedback-title">
              {correct
                ? "✅ ¡Correcto!"
                : <>❌ Era <b>{formatSan(question.answer, esNotation)}</b></>}
            </div>
            <p>{explain(question)}</p>
            <button className="btn btn-newgame" onClick={next}>
              Siguiente pregunta →
            </button>
          </div>
        )}

        {!answered && (
          <p className="trainer-hint">
            💡 Localiza qué pieza está en la casilla azul clara y a dónde va.
            Pista: peones sin letra, piezas con su letra
            ({esNotation ? "C, A, T, D, R" : "N, B, R, Q, K"}).
          </p>
        )}
      </div>
    </div>
  );
}
