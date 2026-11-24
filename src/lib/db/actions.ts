import { db, getSettings } from "./db";
import { applyAttempt, type AttemptOutcome } from "@/lib/engine/mastery";
import { newLearningVerse, uid } from "@/lib/engine/verse";
import type { Attempt, LearningVerse, Mode, VerseRef } from "@/lib/types";
import type { ExerciseResult } from "@/components/exercises/types";

export async function recordAttempt(verse: LearningVerse, mode: Mode, r: ExerciseResult, durationMs: number): Promise<AttemptOutcome> {
  const settings = await getSettings();
  const now = new Date();
  const outcome = applyAttempt(verse, mode, r.accuracy, now, {
    retention: settings.retention,
    missedIndexes: r.missedIndexes,
    missedWords: r.missedWords,
    clozeLevel: r.clozeLevel,
  });
  const attempt: Attempt = {
    id: uid(),
    verseId: verse.id,
    mode,
    date: now.toISOString(),
    accuracy: r.accuracy,
    durationMs,
    summary: r.summary,
    errors: r.errors.slice(0, 30),
    stageBefore: outcome.stageBefore,
    stageAfter: outcome.stageAfter,
    rating: outcome.rating,
    nextDue: outcome.rating !== undefined ? outcome.verse.due : undefined,
  };
  await db.transaction("rw", db.verses, db.attempts, async () => {
    await db.verses.put(outcome.verse);
    await db.attempts.add(attempt);
  });
  return outcome;
}

export async function findExisting(translationId: string, ref: VerseRef) {
  const all = await db.verses.where("[ref.book+ref.chapter+ref.verseStart]").equals([ref.book, ref.chapter, ref.verseStart]).toArray();
  return all.find((v) => v.translationId === translationId && v.ref.verseEnd === ref.verseEnd);
}

export async function addVerse(data: Parameters<typeof newLearningVerse>[0]): Promise<{ verse: LearningVerse; created: boolean }> {
  if (data.ref.book) {
    const existing = await findExisting(data.translationId, data.ref);
    if (existing) return { verse: existing, created: false };
  }
  const v = newLearningVerse(data);
  await db.verses.add(v);
  return { verse: v, created: true };
}

export async function deleteVerse(id: string) {
  await db.transaction("rw", db.verses, db.attempts, async () => {
    await db.verses.delete(id);
    await db.attempts.where("verseId").equals(id).delete();
  });
}

export async function updateVerse(id: string, changes: Partial<LearningVerse>) {
  await db.verses.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

/** Days in a row (ending today or yesterday) with at least one exercise. */
export function streakFrom(dates: string[], now = new Date()): number {
  const days = new Set(dates.map((d) => localDay(new Date(d))));
  const cur = new Date(now);
  if (!days.has(localDay(cur))) cur.setDate(cur.getDate() - 1);
  let n = 0;
  while (days.has(localDay(cur))) {
    n++;
    cur.setDate(cur.getDate() - 1);
  }
  return n;
}

export function localDay(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
