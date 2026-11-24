import { describe, expect, it } from "vitest";
import { applyAttempt, isMastered } from "@/lib/engine/mastery";
import { newLearningVerse } from "@/lib/engine/verse";

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n, 12));

describe("mastery engine", () => {
  it("walks the learning ladder and graduates only after writing from memory", () => {
    let v = newLearningVerse({ text: "Jehová es mi pastor; nada me faltará.", reference: "Salmos 23:1", ref: { book: "PSA", chapter: 23, verseStart: 1, verseEnd: 1 }, translationId: "rv1909", source: "biblioteca" }, day(0));
    v = applyAttempt(v, "fragmentos", 1, day(0)).verse;
    expect(v.stage).toBe("aprendiendo");
    // completar must be passed at a high enough level
    v = applyAttempt(v, "completar", 1, day(0), { clozeLevel: 0.4 }).verse;
    expect(v.ladderStep).toBe(1);
    v = applyAttempt(v, "completar", 1, day(0), { clozeLevel: 0.6 }).verse;
    v = applyAttempt(v, "elegir", 1, day(0)).verse;
    v = applyAttempt(v, "ordenar-palabras", 1, day(0)).verse;
    expect(v.stage).toBe("aprendiendo");
    const out = applyAttempt(v, "escribir", 1, day(0));
    expect(out.verse.stage).toBe("consolidando");
    expect(out.verse.card).toBeDefined();
    expect(new Date(out.verse.due).getTime()).toBeGreaterThan(day(0).getTime());
  });

  it("multiple choice never counts towards mastery", () => {
    let v = graduated();
    for (let d = 1; d < 60; d += 7) v = applyAttempt(v, "elegir", 1, day(d)).verse;
    expect(v.stage).toBe("consolidando");
    expect(v.evidence.length).toBe(0);
  });

  it("needs 3 successive no-help recalls on different days spanning 3 weeks", () => {
    let v = graduated();
    v = applyAttempt(v, "escribir", 1, day(2)).verse;
    v = applyAttempt(v, "escribir", 1, day(2)).verse; // same day: not extra evidence
    expect(v.evidence.length).toBe(1);
    v = applyAttempt(v, "sin-pistas", 0.97, day(8)).verse;
    expect(v.stage).toBe("consolidando");
    v = applyAttempt(v, "escribir", 1, day(16)).verse;
    expect(v.stage).toBe("consolidando"); // only 14 days span
    const out = applyAttempt(v, "escribir", 1, day(24));
    expect(out.verse.stage).toBe("dominado");
    expect(out.justMastered).toBe(true);
  });

  it("a weak recall breaks the run, and a mastered verse can lapse", () => {
    let v = graduated();
    v = applyAttempt(v, "escribir", 1, day(2)).verse;
    v = applyAttempt(v, "escribir", 0.8, day(8)).verse;
    expect(v.evidence.length).toBe(0);
    v.evidence = [
      { date: day(1).toISOString(), accuracy: 1, mode: "escribir" },
      { date: day(10).toISOString(), accuracy: 1, mode: "escribir" },
      { date: day(30).toISOString(), accuracy: 1, mode: "escribir" },
    ];
    expect(isMastered(v.evidence)).toBe(true);
    v.stage = "dominado";
    v = applyAttempt(v, "escribir", 0.5, day(60)).verse;
    expect(v.stage).toBe("consolidando");
  });

  it("bad recall brings the review closer than good recall", () => {
    const g = applyAttempt(graduated(), "escribir", 1, day(5)).verse;
    const b = applyAttempt(graduated(), "escribir", 0.3, day(5)).verse;
    expect(new Date(b.due).getTime()).toBeLessThan(new Date(g.due).getTime());
  });
});

function graduated() {
  let v = newLearningVerse({ text: "Jehová es mi pastor; nada me faltará.", reference: "Salmos 23:1", ref: { book: "PSA", chapter: 23, verseStart: 1, verseEnd: 1 }, translationId: "rv1909", source: "biblioteca" }, day(0));
  v.ladderStep = 4;
  v.stage = "aprendiendo";
  v = applyAttempt(v, "escribir", 1, day(0)).verse;
  return v;
}
