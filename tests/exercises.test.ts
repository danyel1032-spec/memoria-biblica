import { describe, expect, it } from "vitest";
import { splitFragments } from "@/lib/engine/fragments";
import { buildChoiceQuestions, buildCloze, buildOrderPuzzle, buildVocabulary, gradeBlank, nextClozeLevel } from "@/lib/engine/exercises";
import { tokenize } from "@/lib/text/normalize";

const PSA = "Jehová es mi pastor; nada me faltará.";
const JHN =
  "Porque de tal manera amó Dios al mundo, que ha dado á su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.";

describe("fragments", () => {
  it("splits Psalm 23:1 as in the spec", () => {
    expect(splitFragments(PSA).map((f) => f.text)).toEqual(["Jehová es mi pastor;", "nada me faltará."]);
  });
  it("keeps every word exactly once and pieces short", () => {
    const f = splitFragments(JHN);
    expect(f.map((x) => x.text).join(" ")).toBe(JHN);
    for (const x of f) expect(x.end - x.start).toBeLessThanOrEqual(11);
    expect(f.length).toBeGreaterThanOrEqual(3);
  });
});

describe("cloze", () => {
  it("hides content words first and grows with the level", () => {
    const low = buildCloze(JHN, 0.2, 1);
    const high = buildCloze(JHN, 0.8, 1);
    expect(high.hidden.length).toBeGreaterThan(low.hidden.length);
    for (const i of low.hidden) expect(["de", "al", "que", "á", "su", "en", "no", "se", "mas"]).not.toContain(low.tokens[i].word);
  });
  it("grades blanks leniently on form", () => {
    const t = tokenize("faltará")[0];
    expect(gradeBlank(t, "faltara")).toBe("forma");
    expect(gradeBlank(t, "faltará")).toBe("correcta");
    expect(gradeBlank(t, "falta")).toBe("incorrecta");
  });
  it("adapts the level", () => {
    expect(nextClozeLevel(0.4, 1)).toBeCloseTo(0.6);
    expect(nextClozeLevel(0.4, 0.5)).toBeCloseTo(0.2);
  });
});

describe("choice", () => {
  it("builds options with the answer and plausible distractors", () => {
    const vocab = buildVocabulary([JHN, PSA, "Dios amó amará amaba mundos mundo mundo tierra tierra pastor pastor pastores pastores señor señor faltará faltará morirá morirá vivirá vivirá eterna eterna interna interna"]);
    const qs = buildChoiceQuestions(PSA, vocab, 3);
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      expect(q.options).toContain(q.answer);
      expect(new Set(q.options).size).toBe(q.options.length);
    }
  });
});

describe("order", () => {
  it("never starts solved", () => {
    for (let s = 0; s < 20; s++) {
      const p = buildOrderPuzzle(PSA, "palabras", s);
      expect(p.shuffled.every((v, i) => v === i)).toBe(false);
    }
  });
});
