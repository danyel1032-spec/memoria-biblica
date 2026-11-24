import type { Card } from "ts-fsrs";

export interface VerseRef {
  /** USFM book id, e.g. "PSA". Empty for manual entries without a book. */
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
}

/** Where a learning verse is in its life. */
export type Stage = "nuevo" | "aprendiendo" | "consolidando" | "dominado";

/** Exercise modes. Letters follow the project spec. */
export type Mode =
  | "fragmentos" // A
  | "completar" // B
  | "elegir" // C
  | "ordenar-palabras" // D
  | "ordenar-frases" // D
  | "escribir" // E
  | "voz" // F
  | "sin-pistas"; // G

/** Modes where the learner sees nothing but the reference. Only these prove mastery. */
export const RECALL_MODES: Mode[] = ["escribir", "voz", "sin-pistas"];

/** Learning ladder for a new verse, from most support to none. */
export const LADDER: Mode[] = ["fragmentos", "completar", "elegir", "ordenar-palabras", "escribir"];

export interface MasteryEvidence {
  date: string; // ISO
  accuracy: number;
  mode: Mode;
}

export interface LearningVerse {
  id: string;
  translationId: string;
  ref: VerseRef;
  /** Display reference, e.g. "Salmos 23:1" (also used for manual entries). */
  reference: string;
  text: string;
  source: "biblioteca" | "manual" | "importado";
  addedAt: string;
  favorite: boolean;
  collectionIds: string[];
  notes: string;
  context: string;
  stage: Stage;
  /** Index into LADDER while stage is "aprendiendo". */
  ladderStep: number;
  /** Fragments already mastered in step A. */
  fragmentsDone: number;
  /** Share of words hidden in "completar" (adaptive). */
  clozeLevel: number;
  /** Spaced-repetition state (FSRS). Absent until the verse graduates from learning. */
  card?: Card;
  /** When the verse is next due. Indexed for the daily session. */
  due: string;
  reviews: number;
  /** Recall-mode attempts (no help). */
  recallCount: number;
  recallAccuracySum: number;
  lastAccuracy: number | null;
  /** Successive no-help recalls that count towards mastery. */
  evidence: MasteryEvidence[];
  masteredAt: string | null;
  /** Normalised expected word -> times it was missed. */
  errorWords: Record<string, number>;
  /** Word index -> times missed (to find weak fragments). */
  errorPositions: Record<number, number>;
  updatedAt: string;
}

export interface Attempt {
  id: string;
  verseId: string;
  mode: Mode;
  date: string;
  accuracy: number;
  durationMs: number;
  /** Counts of each error type. */
  summary: Record<string, number>;
  /** Short note of what was wrong, e.g. "faltará → falta". */
  errors: string[];
  stageBefore: Stage;
  stageAfter: Stage;
  /** FSRS rating given, if this attempt updated the schedule. */
  rating?: number;
  nextDue?: string;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
}

export interface Settings {
  translationId: string;
  newPerDay: number;
  maxReviewsPerSession: number;
  /** Target probability of remembering a verse when it comes up (FSRS). */
  retention: number;
}

export const DEFAULT_SETTINGS: Settings = {
  translationId: "rv1909",
  newPerDay: 2,
  maxReviewsPerSession: 30,
  retention: 0.9,
};
