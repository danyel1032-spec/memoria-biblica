"use client";

import { useEffect, useRef, useState } from "react";
import type { LearningVerse, Mode } from "@/lib/types";
import { recordAttempt } from "@/lib/db/actions";
import { MODE_LABEL, RATING_LABEL, type AttemptOutcome } from "@/lib/engine/mastery";
import { splitFragments } from "@/lib/engine/fragments";
import { tokenize } from "@/lib/text/normalize";
import { DiffView } from "./exercises/DiffView";
import { WriteExercise } from "./exercises/WriteExercise";
import { RecallExercise } from "./exercises/RecallExercise";
import { FragmentExercise } from "./exercises/FragmentExercise";
import { ClozeExercise } from "./exercises/ClozeExercise";
import { ChoiceExercise } from "./exercises/ChoiceExercise";
import { OrderExercise } from "./exercises/OrderExercise";
import type { ExerciseResult } from "./exercises/types";
import { ErrorBox, StageBadge } from "./ui";

const HINTLESS: Mode[] = ["escribir", "sin-pistas", "voz"];

export interface RunnerDone {
  outcome: AttemptOutcome;
  result: ExerciseResult;
}

/**
 * Runs one exercise on one verse, saves the attempt and shows the evaluation.
 * `onNext` is called when the learner moves on.
 */
export function PracticeRunner({
  verse,
  mode,
  onNext,
  nextLabel = "Continuar",
  translationName,
}: {
  verse: LearningVerse;
  mode: Mode;
  onNext: (d: RunnerDone | null) => void;
  nextLabel?: string;
  translationName?: string;
}) {
  const [done, setDone] = useState<RunnerDone | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [current, setCurrent] = useState(verse);
  const started = useRef(0);
  useEffect(() => {
    started.current = Date.now();
  }, []);

  const handle = async (r: ExerciseResult) => {
    try {
      const outcome = await recordAttempt(current, mode, r, Date.now() - started.current);
      setDone({ outcome, result: r });
      setCurrent(outcome.verse);
    } catch {
      setError("No se pudo guardar el resultado en este dispositivo. Revisa que el navegador no esté en modo privado y vuelve a intentarlo.");
    }
  };

  const retry = () => {
    setDone(null);
    setRound((x) => x + 1);
    started.current = Date.now();
  };

  const props = { verse: current, onDone: handle };
  const exercise = (() => {
    switch (mode) {
      case "fragmentos":
        return <FragmentExercise key={round} {...props} />;
      case "completar":
        return <ClozeExercise key={round} {...props} />;
      case "elegir":
        return <ChoiceExercise key={round} {...props} />;
      case "ordenar-palabras":
        return <OrderExercise key={round} {...props} unit={tokenize(current.text).length > 40 ? "frases" : "palabras"} />;
      case "ordenar-frases":
        return <OrderExercise key={round} {...props} unit="frases" />;
      case "sin-pistas":
        return <RecallExercise key={round} {...props} />;
      case "escribir":
      default:
        return <WriteExercise key={round} {...props} />;
    }
  })();

  const weakFragments = done
    ? splitFragments(current.text).filter((f) => done.result.missedIndexes.some((i) => i >= f.start && i < f.end))
    : [];

  return (
    <section aria-live="polite">
      <div className="mb-4">
        <p className="text-xs font-semibold tracking-wide text-gold uppercase">{MODE_LABEL[mode]}</p>
        <h2 className="mt-1 text-2xl font-bold">{current.reference}</h2>
        {translationName && <p className="text-xs text-muted">{translationName}</p>}
        {HINTLESS.includes(mode) && !done && <p className="mt-1 text-xs text-muted">Sin ayudas: solo ves la referencia.</p>}
      </div>

      {error && <ErrorBox message={error} />}

      {!done ? (
        exercise
      ) : (
        <div>
          <div className="card p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-4xl font-bold tabular-nums">{Math.round(done.result.accuracy * 100)} %</p>
              <div className="text-right text-sm">
                <StageBadge stage={done.outcome.stageAfter} />
                {done.outcome.rating !== undefined && <p className="mt-1 text-muted">Calificación: {RATING_LABEL[done.outcome.rating]}</p>}
              </div>
            </div>
            <p className={`mt-2 text-sm ${done.outcome.justMastered ? "font-semibold text-ok" : "text-muted"}`}>{done.outcome.message}</p>
          </div>

          <div className="card mt-4 p-5">
            <p className="mb-3 text-sm font-semibold">Texto correcto</p>
            {done.result.compare ? (
              <DiffView result={done.result.compare} />
            ) : (
              <p className="scripture text-lg">
                {tokenize(current.text).map((t, i) => (
                  <span key={i} className={done.result.missedIndexes.includes(i) ? "rounded bg-bad-soft px-1 text-bad" : ""}>
                    {t.raw}{" "}
                  </span>
                ))}
              </p>
            )}
          </div>

          {weakFragments.length > 0 && (
            <div className="card mt-4 p-5">
              <p className="text-sm font-semibold">Fragmentos para reforzar</p>
              <ul className="scripture mt-2 list-disc pl-5 text-base">
                {weakFragments.map((f) => (
                  <li key={f.start}>{f.text}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button className="btn btn-secondary" onClick={retry}>
              Repetir
            </button>
            <button className="btn btn-primary" onClick={() => onNext(done)} autoFocus>
              {nextLabel}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
