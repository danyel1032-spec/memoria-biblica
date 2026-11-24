"use client";

import { useMemo, useState } from "react";
import { tokenize } from "@/lib/text/normalize";
import type { ExerciseProps } from "./types";

/**
 * G. Recuperación sin pistas: only the reference. The learner recites (aloud or
 * in their head), then reveals the text and marks every word they missed.
 */
export function RecallExercise({ verse, onDone }: ExerciseProps) {
  const tokens = useMemo(() => tokenize(verse.text), [verse.text]);
  const [revealed, setRevealed] = useState(false);
  const [missed, setMissed] = useState<Set<number>>(new Set());

  const toggle = (i: number) =>
    setMissed((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  const finish = (all: "none" | "all" | "marked") => {
    const idx = all === "all" ? tokens.map((_, i) => i) : all === "none" ? [] : [...missed].sort((a, b) => a - b);
    onDone({
      accuracy: tokens.length ? 1 - idx.length / tokens.length : 0,
      missedIndexes: idx,
      missedWords: idx.map((i) => tokens[i].norm),
      errors: idx.slice(0, 20).map((i) => `«${tokens[i].word}»`),
      summary: { correcta: tokens.length - idx.length, omitida: idx.length },
    });
  };

  if (!revealed) {
    return (
      <div>
        <p className="text-sm text-muted">
          Recita el texto completo en voz alta o en tu mente, sin mirar nada. Cuando termines, revela el texto y sé honesto: marca cada palabra que
          olvidaste, cambiaste o dijiste en otro orden.
        </p>
        <div className="mt-6 grid gap-3">
          <button className="btn btn-primary" onClick={() => setRevealed(true)}>
            Ya lo recité, mostrar el texto
          </button>
          <button className="btn btn-secondary" onClick={() => finish("all")}>
            No lo recuerdo
          </button>
        </div>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm text-muted">Toca las palabras que no recordaste bien.</p>
      <p className="scripture mt-4 text-lg leading-10">
        {tokens.map((t, i) => (
          <button
            key={i}
            onClick={() => toggle(i)}
            aria-pressed={missed.has(i)}
            className={`mr-1 rounded px-1 ${missed.has(i) ? "bg-bad-soft text-bad line-through" : "hover:bg-surface-2"}`}
          >
            {t.raw}
          </button>
        ))}
      </p>
      <div className="mt-6 grid gap-3">
        {missed.size === 0 ? (
          <button className="btn btn-primary" onClick={() => finish("none")}>
            Lo recordé todo exactamente
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => finish("marked")}>
            Guardar ({missed.size} {missed.size === 1 ? "palabra fallada" : "palabras falladas"})
          </button>
        )}
      </div>
    </div>
  );
}
