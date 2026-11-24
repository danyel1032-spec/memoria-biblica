import { isContentWord, isTypo, normalizeWord, tokenize, type Token } from "@/lib/text/normalize";
import { splitFragments } from "./fragments";
import { rng, shuffle } from "./random";

// ---------- B. Completar palabras (cloze) ----------

export interface Cloze {
  tokens: Token[];
  /** Indexes of hidden words, ascending. */
  hidden: number[];
}

/**
 * Hides a share of the words. Meaningful words go first; function words are
 * hidden only at high levels, so difficulty grows with the level (0.1..1).
 */
export function buildCloze(text: string, level: number, seed: number): Cloze {
  const tokens = tokenize(text);
  const rand = rng(seed);
  const want = Math.max(1, Math.round(tokens.length * Math.min(1, Math.max(0.1, level))));
  const idx = tokens.map((_, i) => i);
  const content = shuffle(idx.filter((i) => isContentWord(tokens[i])), rand);
  const rest = shuffle(idx.filter((i) => !isContentWord(tokens[i])), rand);
  const hidden = [...content, ...rest].slice(0, want).sort((a, b) => a - b);
  return { tokens, hidden };
}

export type BlankStatus = "correcta" | "forma" | "ortografia" | "incorrecta";

export function gradeBlank(expected: Token, answer: string): BlankStatus {
  const norm = normalizeWord(answer.trim());
  if (!norm) return "incorrecta";
  if (norm === expected.norm) return answer.trim().replace(/[.,;:!?¡¿]/g, "") === expected.word ? "correcta" : "forma";
  if (isTypo(expected.norm, norm)) return "ortografia";
  return "incorrecta";
}

/** Adjusts the share of hidden words after an attempt (adaptive difficulty). */
export function nextClozeLevel(level: number, accuracy: number): number {
  let next = level;
  if (accuracy >= 0.95) next += 0.2;
  else if (accuracy >= 0.85) next += 0.1;
  else if (accuracy < 0.6) next -= 0.2;
  else if (accuracy < 0.75) next -= 0.1;
  return Math.round(Math.min(1, Math.max(0.2, next)) * 100) / 100;
}

// ---------- C. Seleccionar la palabra correcta ----------

export interface ChoiceQuestion {
  index: number;
  answer: string;
  options: string[];
}

/** Vocabulary of a translation, used to build plausible distractors. */
export interface Vocabulary {
  /** Normalised word -> most common written form and frequency. */
  words: Map<string, { form: string; count: number }>;
  /** Words grouped by their last two letters (similar grammatical form). */
  bySuffix: Map<string, string[]>;
}

export function buildVocabulary(texts: Iterable<string>): Vocabulary {
  const counts = new Map<string, Map<string, number>>();
  for (const text of texts) {
    for (const t of tokenize(text)) {
      if (t.norm.length < 3) continue;
      const lower = t.word.toLowerCase();
      if (!counts.has(t.norm)) counts.set(t.norm, new Map());
      const forms = counts.get(t.norm)!;
      forms.set(lower, (forms.get(lower) ?? 0) + 1);
    }
  }
  const words = new Map<string, { form: string; count: number }>();
  const bySuffix = new Map<string, string[]>();
  for (const [norm, forms] of counts) {
    let best = "";
    let total = 0;
    let bestCount = 0;
    for (const [f, c] of forms) {
      total += c;
      if (c > bestCount) {
        best = f;
        bestCount = c;
      }
    }
    if (total < 2) continue; // skip hapax: too odd to be plausible
    words.set(norm, { form: best, count: total });
    const suf = norm.slice(-2);
    if (!bySuffix.has(suf)) bySuffix.set(suf, []);
    bySuffix.get(suf)!.push(norm);
  }
  return { words, bySuffix };
}

function matchCase(form: string, model: string): string {
  return model[0] && model[0] === model[0].toUpperCase() && model[0] !== model[0].toLowerCase()
    ? form[0].toUpperCase() + form.slice(1)
    : form;
}

/**
 * Picks distractors that look like the right answer: same ending (so the
 * grammar still fits), similar length and similar frequency in the Bible.
 */
export function distractorsFor(token: Token, vocab: Vocabulary, exclude: Set<string>, rand: () => number, n = 3): string[] {
  const target = token.norm;
  const freq = vocab.words.get(target)?.count ?? 10;
  const pool = (vocab.bySuffix.get(target.slice(-2)) ?? []).filter(
    (w) => w !== target && !exclude.has(w) && Math.abs(w.length - target.length) <= 3,
  );
  const scored = pool
    .map((w) => {
      const c = vocab.words.get(w)!.count;
      return { w, score: Math.abs(Math.log(c + 1) - Math.log(freq + 1)) + Math.abs(w.length - target.length) * 0.3 + rand() * 1.5 };
    })
    .sort((a, b) => a.score - b.score);
  const picked: string[] = [];
  for (const { w } of scored) {
    if (picked.length >= n) break;
    // Avoid near-duplicates of each other or of the answer (they look like typos).
    if (picked.some((p) => isTypo(p, w) || p === w) || isTypo(target, w)) continue;
    picked.push(w);
  }
  // Fallback: any frequent word of similar length.
  if (picked.length < n) {
    const extra = shuffle([...vocab.words.keys()], rand).filter(
      (w) => w !== target && !exclude.has(w) && !picked.includes(w) && Math.abs(w.length - target.length) <= 2,
    );
    picked.push(...extra.slice(0, n - picked.length));
  }
  return picked.map((w) => matchCase(vocab.words.get(w)!.form, token.word));
}

export function buildChoiceQuestions(text: string, vocab: Vocabulary, seed: number, count = 3): ChoiceQuestion[] {
  const tokens = tokenize(text);
  const rand = rng(seed);
  const exclude = new Set(tokens.map((t) => t.norm));
  const candidates = shuffle(
    tokens.map((_, i) => i).filter((i) => isContentWord(tokens[i])),
    rand,
  )
    .slice(0, Math.min(count, Math.max(1, Math.ceil(tokens.length / 4))))
    .sort((a, b) => a - b);
  return candidates.map((index) => {
    const t = tokens[index];
    const opts = shuffle([t.word, ...distractorsFor(t, vocab, exclude, rand)], rand);
    return { index, answer: t.word, options: opts };
  });
}

// ---------- D. Ordenar palabras / frases ----------

export interface OrderPuzzle {
  /** Pieces in the correct order. */
  pieces: string[];
  /** Indexes into pieces, in the order they are shown. */
  shuffled: number[];
}

export function buildOrderPuzzle(text: string, unit: "palabras" | "frases", seed: number): OrderPuzzle {
  const pieces =
    unit === "frases" ? splitFragments(text).map((f) => f.text) : tokenize(text).map((t) => t.raw);
  const rand = rng(seed);
  let shuffled = shuffle(
    pieces.map((_, i) => i),
    rand,
  );
  // Never show it already solved.
  for (let tries = 0; tries < 5 && pieces.length > 1 && shuffled.every((v, i) => v === i); tries++) {
    shuffled = shuffle(shuffled, rand);
  }
  return { pieces, shuffled };
}
