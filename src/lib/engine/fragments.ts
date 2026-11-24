import { tokenize, type Token } from "@/lib/text/normalize";

/** A short, meaningful phrase of a verse, used for learning step by step. */
export interface Fragment {
  text: string;
  /** Index of the first word in the whole text. */
  start: number;
  /** Index after the last word. */
  end: number;
}

const MIN_WORDS = 3;
const MAX_WORDS = 9;
const SPLIT_BEFORE = new Set(["y", "e", "mas", "pero", "porque", "que", "para", "ni", "sino", "pues", "como", "cuando"]);

function joinTokens(tokens: Token[]): string {
  return tokens.map((t) => t.raw).join(" ");
}

/**
 * Splits a verse into phrases at its punctuation ("Jehová es mi pastor;" /
 * "nada me faltará."), merges phrases that are too short to mean anything and
 * splits long ones before a conjunction, so each piece fits in working memory.
 */
export function splitFragments(text: string): Fragment[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return [];

  // 1. Break after punctuation.
  let ranges: [number, number][] = [];
  let start = 0;
  tokens.forEach((t, i) => {
    if (/[,;:.?!)]["»”’]?$/.test(t.raw) || i === tokens.length - 1) {
      ranges.push([start, i + 1]);
      start = i + 1;
    }
  });

  // 2. Split long ranges before a conjunction close to the middle (or at the middle).
  const split = (r: [number, number]): [number, number][] => {
    const [a, b] = r;
    if (b - a <= MAX_WORDS) return [r];
    const mid = Math.floor((a + b) / 2);
    let best = -1;
    for (let k = a + MIN_WORDS; k <= b - MIN_WORDS; k++) {
      if (SPLIT_BEFORE.has(tokens[k].norm) && (best === -1 || Math.abs(k - mid) < Math.abs(best - mid))) best = k;
    }
    const cut = best === -1 ? mid : best;
    return [...split([a, cut]), ...split([cut, b])];
  };
  ranges = ranges.flatMap(split);

  // 3. Merge ranges that are too short with their neighbour.
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const prev = merged[merged.length - 1];
    if (prev && (r[1] - r[0] < MIN_WORDS || prev[1] - prev[0] < MIN_WORDS) && r[1] - prev[0] <= MAX_WORDS + 2) {
      prev[1] = r[1];
    } else merged.push([r[0], r[1]]);
  }

  return merged.map(([a, b]) => ({ text: joinTokens(tokens.slice(a, b)), start: a, end: b }));
}
