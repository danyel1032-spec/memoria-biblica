import { isTypo, tokenize, type Token } from "@/lib/text/normalize";

/**
 * Word-by-word evaluation of a recall attempt against the original text.
 *
 * - correcta:     same word.
 * - forma:        same word; only accents, capitals or punctuation differ. Not a memory error.
 * - ortografia:   a spelling slip in the right word. Not a memory error.
 * - sustituida:   a different word in that position.
 * - omitida:      word missing.
 * - desordenada:  the word was said, but in another place.
 * - agregada:     extra word that is not in the text.
 */
export type WordStatus =
  | "correcta"
  | "forma"
  | "ortografia"
  | "sustituida"
  | "omitida"
  | "desordenada"
  | "agregada";

export interface WordResult {
  status: WordStatus;
  /** Index in the original text, absent for added words. */
  index?: number;
  expected?: string;
  given?: string;
}

export interface CompareResult {
  words: WordResult[];
  counts: Record<WordStatus, number>;
  /** Number of words in the original text. */
  total: number;
  /** 0..1. Memory accuracy: form and spelling slips are not penalised. */
  accuracy: number;
  /** True when only accents, capitals, punctuation or spelling differ. */
  onlyFormIssues: boolean;
  /** Indexes of original words the learner got wrong (for weak-spot tracking). */
  missedIndexes: number[];
}

type Op = { type: "match" | "sub" | "del" | "ins"; i?: number; j?: number };

function matchKind(e: Token, g: Token): "correcta" | "forma" | "ortografia" | null {
  if (e.norm === g.norm) return e.word === g.word ? "correcta" : "forma";
  if (isTypo(e.norm, g.norm)) return "ortografia";
  return null;
}

export function compareText(expectedText: string, givenText: string): CompareResult {
  return compareTokens(tokenize(expectedText), tokenize(givenText));
}

export function compareTokens(exp: Token[], giv: Token[]): CompareResult {
  const n = exp.length;
  const m = giv.length;
  // Edit-distance DP over words.
  const cost: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) cost[i][0] = i;
  for (let j = 0; j <= m; j++) cost[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = matchKind(exp[i - 1], giv[j - 1]) !== null;
      cost[i][j] = Math.min(
        cost[i - 1][j - 1] + (same ? 0 : 1),
        cost[i - 1][j] + 1,
        cost[i][j - 1] + 1,
      );
    }
  }
  // Backtrace, preferring matches.
  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = matchKind(exp[i - 1], giv[j - 1]) !== null;
      if (cost[i][j] === cost[i - 1][j - 1] + (same ? 0 : 1)) {
        ops.push({ type: same ? "match" : "sub", i: i - 1, j: j - 1 });
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      ops.push({ type: "del", i: i - 1 });
      i--;
    } else {
      ops.push({ type: "ins", j: j - 1 });
      j--;
    }
  }
  ops.reverse();

  // Turn ops into results.
  const words: WordResult[] = ops.map((op) => {
    if (op.type === "match") {
      const e = exp[op.i!];
      const g = giv[op.j!];
      return { status: matchKind(e, g)!, index: op.i, expected: e.word, given: g.word };
    }
    if (op.type === "sub") {
      return { status: "sustituida", index: op.i, expected: exp[op.i!].word, given: giv[op.j!].word };
    }
    if (op.type === "del") return { status: "omitida", index: op.i, expected: exp[op.i!].word };
    return { status: "agregada", given: giv[op.j!].word };
  });

  // Order errors: a word missing in one place and present as an extra word in another
  // was recalled but misplaced. A substitution counts as one missing word plus one extra.
  const keyOf = (w?: string) => (w ? (tokenize(w)[0]?.norm ?? "") : "");
  const moved = new Set<WordResult>();
  const used = new Set<WordResult>();
  for (const w of words) {
    if (w.status !== "omitida" && w.status !== "sustituida") continue;
    const k = keyOf(w.expected);
    const partner = words.find(
      (o) =>
        o !== w &&
        !used.has(o) &&
        (o.status === "agregada" || o.status === "sustituida") &&
        keyOf(o.given) === k,
    );
    if (partner) {
      moved.add(w);
      used.add(partner);
    }
  }
  const finalWords: WordResult[] = [];
  for (const w of words) {
    if (w.status === "agregada") {
      if (!used.has(w)) finalWords.push(w);
    } else if (w.status === "omitida") {
      finalWords.push(moved.has(w) ? { ...w, status: "desordenada" } : w);
    } else if (w.status === "sustituida") {
      const m1 = moved.has(w);
      const u1 = used.has(w);
      if (m1) finalWords.push({ status: "desordenada", index: w.index, expected: w.expected });
      else if (u1) finalWords.push({ status: "omitida", index: w.index, expected: w.expected });
      else finalWords.push(w);
      if (m1 && !u1) finalWords.push({ status: "agregada", given: w.given });
    } else finalWords.push(w);
  }

  const counts: Record<WordStatus, number> = {
    correcta: 0,
    forma: 0,
    ortografia: 0,
    sustituida: 0,
    omitida: 0,
    desordenada: 0,
    agregada: 0,
  };
  for (const w of finalWords) counts[w.status]++;

  const good = counts.correcta + counts.forma + counts.ortografia;
  const credit = good + 0.5 * counts.desordenada;
  const denom = n + counts.agregada;
  const accuracy = denom === 0 ? (m === 0 ? 1 : 0) : credit / denom;
  const missedIndexes = finalWords
    .filter((w) => w.index !== undefined && ["sustituida", "omitida", "desordenada"].includes(w.status))
    .map((w) => w.index!);

  return {
    words: finalWords,
    counts,
    total: n,
    accuracy,
    onlyFormIssues: good === n && counts.agregada === 0 && (counts.forma > 0 || counts.ortografia > 0),
    missedIndexes,
  };
}
