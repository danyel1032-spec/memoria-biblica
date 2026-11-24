import type { CompareResult } from "@/lib/engine/compare";
import type { LearningVerse } from "@/lib/types";

export interface ExerciseResult {
  accuracy: number;
  /** Word indexes of the verse that were wrong. */
  missedIndexes: number[];
  /** Normalised words that were wrong. */
  missedWords: string[];
  /** Short descriptions of errors for the history, e.g. "faltará → falta". */
  errors: string[];
  summary: Record<string, number>;
  /** New adaptive level for "completar". */
  clozeLevel?: number;
  compare?: CompareResult;
}

export interface ExerciseProps {
  verse: LearningVerse;
  onDone: (r: ExerciseResult) => void;
}

export function resultFromCompare(c: CompareResult, tokensNorm: string[]): ExerciseResult {
  const errors: string[] = [];
  for (const w of c.words) {
    if (w.status === "sustituida") errors.push(`${w.expected} → ${w.given}`);
    else if (w.status === "omitida") errors.push(`falta «${w.expected}»`);
    else if (w.status === "desordenada") errors.push(`«${w.expected}» fuera de orden`);
    else if (w.status === "agregada") errors.push(`sobra «${w.given}»`);
  }
  return {
    accuracy: c.accuracy,
    missedIndexes: c.missedIndexes,
    missedWords: c.missedIndexes.map((i) => tokensNorm[i]).filter(Boolean),
    errors,
    summary: { ...c.counts },
    compare: c,
  };
}
