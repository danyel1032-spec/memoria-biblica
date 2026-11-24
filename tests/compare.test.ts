import { describe, expect, it } from "vitest";
import { compareText } from "@/lib/engine/compare";

const PSA = "Jehová es mi pastor; nada me faltará.";

describe("compareText", () => {
  it("perfect recall is 100%", () => {
    const r = compareText(PSA, "Jehová es mi pastor; nada me faltará.");
    expect(r.accuracy).toBe(1);
    expect(r.counts.correcta).toBe(7);
  });
  it("accents, capitals and punctuation are not memory errors", () => {
    const r = compareText(PSA, "jehova es mi pastor nada me faltara");
    expect(r.accuracy).toBe(1);
    expect(r.onlyFormIssues).toBe(true);
    expect(r.counts.forma).toBe(2);
  });
  it("old spelling matches modern spelling", () => {
    const r = compareText("y fué la luz", "Y fue la luz");
    expect(r.accuracy).toBe(1);
  });
  it("detects omitted words", () => {
    const r = compareText(PSA, "Jehová es mi pastor nada faltará");
    expect(r.counts.omitida).toBe(1);
    expect(r.words.find((w) => w.status === "omitida")?.expected).toBe("me");
    expect(r.accuracy).toBeCloseTo(6 / 7);
  });
  it("detects substitutions", () => {
    const r = compareText(PSA, "Jehová es mi pastor nada me falta");
    expect(r.counts.sustituida).toBe(1);
  });
  it("detects added words", () => {
    const r = compareText(PSA, "Jehová es mi buen pastor nada me faltará");
    expect(r.counts.agregada).toBe(1);
    expect(r.accuracy).toBeCloseTo(7 / 8);
  });
  it("detects order errors", () => {
    const r = compareText(PSA, "Jehová mi es pastor nada me faltará");
    expect(r.counts.desordenada).toBe(2);
    expect(r.counts.agregada).toBe(0);
    expect(r.accuracy).toBeLessThan(1);
    expect(r.accuracy).toBeGreaterThan(0.8);
  });
  it("spelling slips in long words are not memory errors", () => {
    const r = compareText("Todo lo puedo en Cristo que me fortalece", "todo lo puedo en cristo que me fortaleze");
    expect(r.counts.ortografia).toBe(1);
    expect(r.accuracy).toBe(1);
  });
  it("changed endings are real substitutions", () => {
    const r = compareText("no se pierda", "no se pierde");
    expect(r.counts.sustituida).toBe(1);
  });
  it("empty answer is 0%", () => {
    const r = compareText(PSA, "");
    expect(r.accuracy).toBe(0);
    expect(r.counts.omitida).toBe(7);
  });
});
