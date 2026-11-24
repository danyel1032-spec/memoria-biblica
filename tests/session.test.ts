import { describe, expect, it } from "vitest";
import { buildSession } from "@/lib/engine/session";
import { applyAttempt } from "@/lib/engine/mastery";
import { newLearningVerse } from "@/lib/engine/verse";

const d = (n: number) => new Date(Date.UTC(2026, 0, 1 + n, 12));
const mk = (i: number) =>
  newLearningVerse({ text: `palabra${i} uno dos tres`, reference: `Ref ${i}`, ref: { book: "PSA", chapter: 1, verseStart: i, verseEnd: i }, translationId: "rv1909", source: "manual" }, d(0));

describe("session", () => {
  it("limits new verses and interleaves with reviews", () => {
    const fresh = [mk(1), mk(2), mk(3)];
    const grads = [mk(4), mk(5), mk(6), mk(7)].map((v) => {
      v.ladderStep = 4;
      v.stage = "aprendiendo";
      return applyAttempt(v, "escribir", 1, d(0)).verse;
    });
    const plan = buildSession([...fresh, ...grads], { now: d(30), newPerDay: 2, startedToday: 0, maxReviews: 30, retention: 0.9 });
    expect(plan.newCount).toBe(2);
    expect(plan.dueCount).toBe(4);
    expect(plan.items[2].kind).toBe("aprender");
    expect(plan.items.filter((i) => i.kind === "repaso").every((i) => ["escribir", "sin-pistas"].includes(i.mode))).toBe(true);
  });
  it("adds older verses when few are due (cumulative review)", () => {
    const grads = [mk(4), mk(5)].map((v) => {
      v.ladderStep = 4;
      v.stage = "aprendiendo";
      return applyAttempt(v, "escribir", 1, d(0)).verse;
    });
    const plan = buildSession(grads, { now: d(0), newPerDay: 2, startedToday: 0, maxReviews: 30, retention: 0.9 });
    expect(plan.dueCount).toBe(0);
    expect(plan.cumulativeCount).toBe(2);
  });
});
