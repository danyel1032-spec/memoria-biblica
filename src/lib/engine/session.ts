import { LADDER, type LearningVerse, type Mode } from "@/lib/types";
import { retrievability } from "./mastery";

export interface SessionItem {
  verseId: string;
  kind: "repaso" | "aprender" | "acumulativo";
  mode: Mode;
}

export interface SessionPlan {
  items: SessionItem[];
  dueCount: number;
  learningCount: number;
  newCount: number;
  cumulativeCount: number;
}

/** No-help recall mode for a review, rotating so the learner both writes and recalls freely. */
export function recallModeFor(v: LearningVerse, voiceAvailable = false): Mode {
  const cycle: Mode[] = voiceAvailable ? ["escribir", "sin-pistas", "voz"] : ["escribir", "sin-pistas"];
  // Always write when the last recall was weak: it gives the most precise feedback.
  if (v.lastAccuracy !== null && v.lastAccuracy < 0.85) return "escribir";
  return cycle[v.recallCount % cycle.length];
}

export function learningModeFor(v: LearningVerse): Mode {
  return LADDER[Math.min(v.ladderStep, LADDER.length - 1)];
}

/**
 * Builds today's session:
 *  1. Reviews that are due (most at risk of being forgotten first).
 *  2. Verses being learned, plus new ones up to the daily limit.
 *  3. Cumulative review: when few reviews are due, older verses join the session
 *     so it never only contains recent material.
 * Learning and review items are interleaved.
 */
export function buildSession(
  verses: LearningVerse[],
  opts: { now: Date; newPerDay: number; startedToday: number; maxReviews: number; retention: number; voiceAvailable?: boolean },
): SessionPlan {
  const { now } = opts;
  const scheduled = verses.filter((v) => v.stage === "consolidando" || v.stage === "dominado");
  const due = scheduled
    .filter((v) => new Date(v.due) <= now)
    .map((v) => ({ v, r: retrievability(v, now, opts.retention) ?? 0 }))
    .sort((a, b) => a.r - b.r)
    .slice(0, opts.maxReviews)
    .map((x) => x.v);

  const learning = verses
    .filter((v) => v.stage === "aprendiendo")
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
    .slice(0, 3);
  const newSlots = Math.max(0, opts.newPerDay - opts.startedToday);
  const fresh = verses
    .filter((v) => v.stage === "nuevo")
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
    .slice(0, newSlots);

  const dueIds = new Set(due.map((v) => v.id));
  const cumulative =
    due.length < 3
      ? scheduled
          .filter((v) => !dueIds.has(v.id))
          .map((v) => ({ v, r: retrievability(v, now, opts.retention) ?? 1 }))
          .sort((a, b) => a.r - b.r)
          .slice(0, 3 - due.length)
          .map((x) => x.v)
      : [];

  const reviewItems: SessionItem[] = [
    ...due.map((v) => ({ verseId: v.id, kind: "repaso" as const, mode: recallModeFor(v, opts.voiceAvailable) })),
    ...cumulative.map((v) => ({ verseId: v.id, kind: "acumulativo" as const, mode: recallModeFor(v, opts.voiceAvailable) })),
  ];
  const learnItems: SessionItem[] = [...learning, ...fresh].map((v) => ({
    verseId: v.id,
    kind: "aprender" as const,
    mode: learningModeFor(v),
  }));

  // Interleave: two reviews, then one learning item.
  const items: SessionItem[] = [];
  let r = 0;
  let l = 0;
  while (r < reviewItems.length || l < learnItems.length) {
    for (let k = 0; k < 2 && r < reviewItems.length; k++) items.push(reviewItems[r++]);
    if (l < learnItems.length) items.push(learnItems[l++]);
  }
  return {
    items,
    dueCount: due.length,
    learningCount: learning.length,
    newCount: fresh.length,
    cumulativeCount: cumulative.length,
  };
}
