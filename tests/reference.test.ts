import { describe, expect, it } from "vitest";
import { formatReference, parseReference } from "@/lib/bible/reference";

describe("references", () => {
  it.each([
    ["Juan 3:16", { book: "JHN", chapter: 3, verseStart: 16, verseEnd: 16 }],
    ["jn 3.16", { book: "JHN", chapter: 3, verseStart: 16, verseEnd: 16 }],
    ["Sal 23", { book: "PSA", chapter: 23, verseStart: undefined, verseEnd: undefined }],
    ["salmo 23:1-3", { book: "PSA", chapter: 23, verseStart: 1, verseEnd: 3 }],
    ["1 Co 13:4–7", { book: "1CO", chapter: 13, verseStart: 4, verseEnd: 7 }],
    ["1 Juan 1:9", { book: "1JN", chapter: 1, verseStart: 9, verseEnd: 9 }],
    ["Filipenses 4:13", { book: "PHP", chapter: 4, verseStart: 13, verseEnd: 13 }],
    ["Génesis 1:1", { book: "GEN", chapter: 1, verseStart: 1, verseEnd: 1 }],
    ["genesis 1:1", { book: "GEN", chapter: 1, verseStart: 1, verseEnd: 1 }],
    ["Apoc 3:20", { book: "REV", chapter: 3, verseStart: 20, verseEnd: 20 }],
    ["Romanos 8:28", { book: "ROM", chapter: 8, verseStart: 28, verseEnd: 28 }],
  ])("parses %s", (input, expected) => {
    expect(parseReference(input)).toEqual(expected);
  });
  it("rejects plain words", () => {
    expect(parseReference("amor")).toBeNull();
  });
  it("formats", () => {
    expect(formatReference({ book: "1CO", chapter: 13, verseStart: 4, verseEnd: 7 })).toBe("1 Corintios 13:4-7");
  });
});
