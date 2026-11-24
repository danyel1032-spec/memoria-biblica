"use client";

import { useMemo, useState } from "react";
import { compareText } from "@/lib/engine/compare";
import { buildOrderPuzzle } from "@/lib/engine/exercises";
import { randomSeed } from "@/lib/engine/random";
import { tokenize } from "@/lib/text/normalize";
import { Icon } from "../Icon";
import { resultFromCompare, type ExerciseProps } from "./types";

/** D. Ordenar palabras o frases. Tap pieces to build the text; tap a placed piece to return it. */
export function OrderExercise({ verse, onDone, unit }: ExerciseProps & { unit: "palabras" | "frases" }) {
  const [seed] = useState(randomSeed);
  const puzzle = useMemo(() => buildOrderPuzzle(verse.text, unit, seed), [verse.text, unit, seed]);
  const [placed, setPlaced] = useState<number[]>([]);
  const remaining = puzzle.shuffled.filter((i) => !placed.includes(i));

  const submit = () => {
    const built = placed.map((i) => puzzle.pieces[i]).join(" ");
    const c = compareText(verse.text, built);
    onDone(resultFromCompare(c, tokenize(verse.text).map((t) => t.norm)));
  };

  return (
    <div>
      <p className="text-sm text-muted">Toca las {unit} en el orden correcto.</p>
      <div className="card scripture mt-4 min-h-28 p-3 text-lg" aria-live="polite">
        {placed.length === 0 && <span className="text-muted">Tu texto aparecerá aquí.</span>}
        {placed.map((i, pos) => (
          <button key={`${i}-${pos}`} onClick={() => setPlaced((p) => p.filter((_, k) => k !== pos))} className="mr-1.5 mb-1.5 rounded-lg bg-brand-soft px-2 py-1 text-left">
            {puzzle.pieces[i]}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {remaining.map((i) => (
          <button key={i} onClick={() => setPlaced((p) => [...p, i])} className="scripture rounded-lg border border-line bg-surface px-3 py-2 text-left text-lg">
            {puzzle.pieces[i]}
          </button>
        ))}
      </div>
      <div className="mt-5 flex gap-3">
        <button className="btn btn-secondary" onClick={() => setPlaced((p) => p.slice(0, -1))} disabled={!placed.length} aria-label="Deshacer">
          <Icon name="undo" />
        </button>
        <button className="btn btn-primary flex-1" onClick={submit} disabled={remaining.length > 0}>
          Comprobar
        </button>
      </div>
    </div>
  );
}
