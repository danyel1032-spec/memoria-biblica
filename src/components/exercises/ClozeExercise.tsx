"use client";

import { useMemo, useState } from "react";
import { buildCloze, gradeBlank, nextClozeLevel, type BlankStatus } from "@/lib/engine/exercises";
import { randomSeed } from "@/lib/engine/random";
import type { ExerciseProps } from "./types";

/** B. Completar palabras, with the share of hidden words adapting to performance. */
export function ClozeExercise({ verse, onDone }: ExerciseProps) {
  const [seed] = useState(randomSeed);
  const cloze = useMemo(() => buildCloze(verse.text, verse.clozeLevel, seed), [verse.text, verse.clozeLevel, seed]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [graded, setGraded] = useState<Record<number, BlankStatus> | null>(null);
  const hiddenSet = new Set(cloze.hidden);

  const check = () => {
    const g: Record<number, BlankStatus> = {};
    for (const i of cloze.hidden) g[i] = gradeBlank(cloze.tokens[i], answers[i] ?? "");
    setGraded(g);
  };

  const finish = () => {
    if (!graded) return;
    const wrong = cloze.hidden.filter((i) => graded[i] === "incorrecta");
    const accuracy = (cloze.hidden.length - wrong.length) / cloze.hidden.length;
    onDone({
      accuracy,
      missedIndexes: wrong,
      missedWords: wrong.map((i) => cloze.tokens[i].norm),
      errors: wrong.map((i) => `${cloze.tokens[i].word} → ${answers[i]?.trim() || "(vacío)"}`),
      summary: { correcta: cloze.hidden.length - wrong.length, sustituida: wrong.length, ocultas: cloze.hidden.length },
      clozeLevel: nextClozeLevel(verse.clozeLevel, accuracy),
    });
  };

  const punctAfter = (raw: string, word: string) => raw.slice(raw.indexOf(word) + word.length);
  const punctBefore = (raw: string, word: string) => raw.slice(0, raw.indexOf(word));

  return (
    <div>
      <p className="text-sm text-muted">
        Escribe las palabras que faltan ({cloze.hidden.length} de {cloze.tokens.length} ocultas).
      </p>
      <p className="scripture mt-4 text-lg leading-[2.6rem]">
        {cloze.tokens.map((t, i) =>
          hiddenSet.has(i) ? (
            <span key={i} className="whitespace-nowrap">
              {punctBefore(t.raw, t.word)}
              <input
                aria-label={`Palabra ${i + 1}`}
                className={`mx-0.5 inline-block rounded-md border px-1.5 py-0.5 text-center align-baseline ${
                  graded
                    ? graded[i] === "incorrecta"
                      ? "border-bad bg-bad-soft text-bad"
                      : "border-ok bg-ok-soft text-ok"
                    : "border-line bg-surface"
                }`}
                style={{ width: `${Math.max(3, t.word.length + 1)}ch` }}
                value={answers[i] ?? ""}
                readOnly={!!graded}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setAnswers((a) => ({ ...a, [i]: e.target.value }))}
              />
              {graded && graded[i] === "incorrecta" && <span className="text-sm text-ok"> ({t.word})</span>}
              {punctAfter(t.raw, t.word)}{" "}
            </span>
          ) : (
            <span key={i}>{t.raw} </span>
          ),
        )}
      </p>
      {!graded ? (
        <button className="btn btn-primary mt-5 w-full" onClick={check}>
          Comprobar
        </button>
      ) : (
        <button className="btn btn-primary mt-5 w-full" onClick={finish} autoFocus>
          Ver resultado
        </button>
      )}
    </div>
  );
}
