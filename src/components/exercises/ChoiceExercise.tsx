"use client";

import { useMemo, useState } from "react";
import { buildChoiceQuestions } from "@/lib/engine/exercises";
import { randomSeed } from "@/lib/engine/random";
import { getVocabulary } from "@/lib/bible/loader";
import { useBible } from "@/lib/hooks/useBible";
import { tokenize } from "@/lib/text/normalize";
import { ErrorBox, Loading } from "../ui";
import type { ExerciseProps } from "./types";

/** C. Seleccionar la palabra correcta. Practice only: never counts as memorised. */
export function ChoiceExercise({ verse, onDone }: ExerciseProps) {
  const { bible, error, retry } = useBible("rv1909");
  const [seed] = useState(randomSeed);
  const questions = useMemo(() => (bible ? buildChoiceQuestions(verse.text, getVocabulary(bible), seed, 4) : []), [bible, verse.text, seed]);
  const tokens = useMemo(() => tokenize(verse.text), [verse.text]);
  const [q, setQ] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrong, setWrong] = useState<number[]>([]);

  if (error) return <ErrorBox message={error} onRetry={retry} />;
  if (!bible) return <Loading label="Preparando opciones…" />;
  if (questions.length === 0) return <p className="text-muted">Este texto es demasiado corto para este ejercicio.</p>;

  const current = questions[q];
  const answered = picked !== null;
  const correct = picked === current.answer;

  const choose = (opt: string) => {
    if (answered) return;
    setPicked(opt);
    if (opt !== current.answer) setWrong((w) => [...w, current.index]);
  };

  const next = () => {
    if (q + 1 < questions.length) {
      setQ(q + 1);
      setPicked(null);
      return;
    }
    const acc = (questions.length - wrong.length) / questions.length;
    onDone({
      accuracy: acc,
      missedIndexes: wrong,
      missedWords: wrong.map((i) => tokens[i].norm),
      errors: wrong.map((i) => `«${tokens[i].word}»`),
      summary: { correcta: questions.length - wrong.length, sustituida: wrong.length },
    });
  };

  const doneIdx = new Set(questions.slice(0, q).map((x) => x.index));
  return (
    <div>
      <p className="text-sm text-muted">
        Pregunta {q + 1} de {questions.length}. Elige la palabra que va en el espacio.
      </p>
      <p className="scripture mt-4 text-lg">
        {tokens.map((t, i) => {
          if (i === current.index)
            return (
              <span key={i}>
                <span className={`rounded px-1.5 font-semibold ${answered ? (correct ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad") : "bg-brand-soft text-brand"}`}>
                  {answered ? current.answer : "_____"}
                </span>{" "}
              </span>
            );
          const pending = questions.some((x) => x.index === i) && !doneIdx.has(i);
          return <span key={i} className={pending ? "text-muted" : ""}>{pending ? "…" : t.raw} </span>;
        })}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {current.options.map((opt) => {
          const state = !answered ? "" : opt === current.answer ? "border-ok bg-ok-soft text-ok" : opt === picked ? "border-bad bg-bad-soft text-bad" : "opacity-50";
          return (
            <button key={opt} onClick={() => choose(opt)} className={`card scripture min-h-14 px-3 text-lg ${state}`} disabled={answered && opt !== picked && opt !== current.answer}>
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <button className="btn btn-primary mt-5 w-full" onClick={next} autoFocus>
          {q + 1 < questions.length ? "Siguiente" : "Ver resultado"}
        </button>
      )}
    </div>
  );
}
