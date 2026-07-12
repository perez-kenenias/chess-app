/**
 * LearnSection.jsx — Sección "Aprender": aperturas, tácticas, remates y finales.
 *
 * Estructura: categorías → lista de lecciones → visor interactivo.
 * El visor reproduce la secuencia de la lección paso a paso sobre un tablero,
 * mostrando el comentario de cada jugada — como los cursos de chess.com.
 */

import { useState, useMemo, useEffect, useCallback } from "react";
import { Chessboard } from "react-chessboard";
import { Chess } from "chess.js";
import { LESSON_CATEGORIES, LESSONS } from "../data/lessons";
import { formatSan, translateSanInText } from "../utils/notation";
import NotationTrainer from "./NotationTrainer";
import { ArrowLayer } from "../utils/arrows";

// Id especial: no es una lección con pasos, abre el quiz interactivo
const TRAINER_ID = "__trainer";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * Pre-calcula las posiciones de la lección aplicando las jugadas con chess.js.
 * Si alguna jugada de la lección fuera ilegal (dato mal escrito), corta ahí
 * y avisa por consola en vez de romper la UI.
 */
function buildLessonPositions(lesson) {
  const chess = new Chess(lesson.initialFen ?? START_FEN);
  const steps = [{ fen: chess.fen(), comment: lesson.intro, san: null, from: null, to: null }];
  for (const mv of lesson.moves) {
    try {
      const made = chess.move(mv.san);
      steps.push({
        fen: chess.fen(),
        comment: mv.comment,
        san: made.san,
        from: made.from,
        to: made.to,
      });
    } catch {
      console.warn(`Lección "${lesson.id}": jugada ilegal ${mv.san} — se corta aquí`);
      break;
    }
  }
  return steps;
}

export default function LearnSection({ active = true, esNotation = false }) {
  const [category, setCategory] = useState("aperturas");
  const [lessonId, setLessonId] = useState(null);
  const [step, setStep]         = useState(0);

  const lessons = LESSONS[category] ?? [];
  const lesson  = lessons.find(l => l.id === lessonId) ?? null;

  const steps = useMemo(
    () => (lesson ? buildLessonPositions(lesson) : []),
    [lesson]
  );

  const openLesson = useCallback((id) => { setLessonId(id); setStep(0); }, []);

  // Teclado ← → dentro de una lección (solo con la pestaña visible)
  useEffect(() => {
    if (!lesson || !active) return;
    const onKey = (e) => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); setStep(s => Math.max(0, s - 1)); }
      if (e.key === "ArrowRight") { e.preventDefault(); setStep(s => Math.min(steps.length - 1, s + 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lesson, steps.length, active]);

  const current = steps[step];
  const squareStyles = useMemo(() => {
    if (!current?.from) return {};
    return {
      [current.from]: { backgroundColor: "rgba(247, 226, 107, 0.45)" },
      [current.to]:   { backgroundColor: "rgba(247, 226, 107, 0.75)" },
    };
  }, [current]);
  const lessonArrows = useMemo(() => {
    if (!current?.from) return [];
    return [{ from: current.from, to: current.to, color: "#81b64c", opacity: 0.85 }];
  }, [current]);

  // ── Vista: entrenador de notación (quiz) ───────────────────────────────
  if (lessonId === TRAINER_ID) {
    return (
      <div className="learn-section">
        <div className="review-title-row">
          <div>
            <div className="review-title">🎯 Entrenador de notación</div>
            <div className="review-subtitle">
              Identifica la notación de la jugada resaltada — la práctica hace al maestro
            </div>
          </div>
          <button className="btn btn-outline" onClick={() => setLessonId(null)}>
            ← Lecciones
          </button>
        </div>
        <NotationTrainer esNotation={esNotation} />
      </div>
    );
  }

  // ── Vista: lista de lecciones ──────────────────────────────────────────
  if (!lesson) {
    return (
      <div className="learn-section">
        <h2>📚 Aprender</h2>
        <p className="review-sub">
          Mini-cursos interactivos: navega cada lección jugada a jugada y
          memoriza los patrones. Cuando juegues, el detector de aperturas te
          dirá qué apertura estás haciendo.
        </p>

        <div className="learn-cats">
          {LESSON_CATEGORIES.map(c => (
            <button
              key={c.key}
              className={`learn-cat ${category === c.key ? "active" : ""}`}
              onClick={() => setCategory(c.key)}
            >
              <span className="learn-cat-label">{c.label}</span>
              <span className="learn-cat-desc">{c.desc}</span>
            </button>
          ))}
        </div>

        <div className="lesson-grid">
          {lessons.map(l => (
            <button key={l.id} className="lesson-card" onClick={() => openLesson(l.id)}>
              <div className="lesson-title">{l.title}</div>
              <div className="lesson-subtitle">{l.subtitle}</div>
              <div className="lesson-len">{l.moves.length} pasos →</div>
            </button>
          ))}

          {/* El quiz vive en la categoría de notación, tras las lecciones teóricas */}
          {category === "notacion" && (
            <button
              className="lesson-card lesson-card--trainer"
              onClick={() => openLesson(TRAINER_ID)}
            >
              <div className="lesson-title">🎯 Entrenador de notación</div>
              <div className="lesson-subtitle">Quiz: ve la jugada, elige su notación</div>
              <div className="lesson-len">Preguntas infinitas · racha y récord →</div>
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Vista: lección abierta ─────────────────────────────────────────────
  return (
    <div className="lesson-layout">
      <div className="lesson-board-col">
        <div className="review-title-row">
          <div>
            <div className="review-title">{lesson.title}</div>
            <div className="review-subtitle">{lesson.subtitle}</div>
          </div>
          <button className="btn btn-outline" onClick={() => setLessonId(null)}>
            ← Lecciones
          </button>
        </div>

        <div style={{ position: "relative" }}>
          <Chessboard
            options={{
              id: "board-lesson", // único: evita colisión de ids con otros tableros montados
              position: current.fen,
              boardOrientation: "white",
              squareStyles,
              canDragPiece: () => false,
              animationDurationInMs: 200,
              showNotation: true,
            }}
          />
          <ArrowLayer arrows={lessonArrows} orientation="white" />
        </div>

        <div className="nav-arrows">
          <button className="nav-btn" onClick={() => setStep(0)} disabled={step === 0}>⏮</button>
          <button className="nav-btn" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}>◀</button>
          <span className="nav-badge nav-badge-live">
            {step === 0 ? "Introducción" : `Paso ${step} de ${steps.length - 1}`}
          </span>
          <button className="nav-btn" onClick={() => setStep(s => Math.min(steps.length - 1, s + 1))}
            disabled={step >= steps.length - 1}>▶</button>
          <button className="nav-btn" onClick={() => setStep(steps.length - 1)}
            disabled={step >= steps.length - 1}>⏭</button>
        </div>
      </div>

      <div className="lesson-text-col">
        <div className="lesson-comment">
          {current.san && <div className="lesson-move-san">▸ {formatSan(current.san, esNotation)}</div>}
          <p>{translateSanInText(current.comment, esNotation)}</p>
        </div>

        {step >= steps.length - 1 && lesson.tips && (
          <div className="lesson-tips">
            <h4>🧠 Para memorizar</h4>
            <ul>
              {lesson.tips.map((t, i) => <li key={i}>{translateSanInText(t, esNotation)}</li>)}
            </ul>
          </div>
        )}

        <div className="lesson-progress">
          {steps.map((_, i) => (
            <button
              key={i}
              className={`lesson-dot ${i === step ? "active" : i < step ? "done" : ""}`}
              onClick={() => setStep(i)}
              aria-label={`Paso ${i}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
