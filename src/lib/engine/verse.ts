import type { LearningVerse, VerseRef } from "@/lib/types";

export function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function newLearningVerse(
  data: { text: string; reference: string; ref: VerseRef; translationId: string; source: LearningVerse["source"] },
  now = new Date(),
): LearningVerse {
  const iso = now.toISOString();
  return {
    id: uid(),
    translationId: data.translationId,
    ref: data.ref,
    reference: data.reference,
    text: data.text.trim(),
    source: data.source,
    addedAt: iso,
    favorite: false,
    collectionIds: [],
    notes: "",
    context: "",
    stage: "nuevo",
    ladderStep: 0,
    fragmentsDone: 0,
    clozeLevel: 0.3,
    due: iso,
    reviews: 0,
    recallCount: 0,
    recallAccuracySum: 0,
    lastAccuracy: null,
    evidence: [],
    masteredAt: null,
    errorWords: {},
    errorPositions: {},
    updatedAt: iso,
  };
}
