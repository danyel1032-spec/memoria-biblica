/**
 * Text normalisation for comparing what the learner produced with the Bible text.
 * Accents, capitals and punctuation are presentation, not memory: "fué" and
 * "fue", "á" and "a", "Jehová" and "jehova" are the same word for scoring.
 */

export interface Token {
  /** Word as it appears, including attached punctuation. */
  raw: string;
  /** Word without punctuation, keeping case and accents. */
  word: string;
  /** Lowercase, no accents, no punctuation: the key used for matching. */
  norm: string;
}

const PUNCT = /[.,;:!?¡¿«»"“”'‘’()[\]{}—–\-…]/g;

export function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function normalizeWord(s: string): string {
  return stripAccents(s.replace(PUNCT, "")).toLowerCase();
}

export function tokenize(text: string): Token[] {
  return text
    .split(/\s+/)
    .map((raw) => {
      const word = raw.replace(PUNCT, "");
      return { raw, word, norm: stripAccents(word).toLowerCase() };
    })
    .filter((t) => t.norm.length > 0);
}

/** Damerau-Levenshtein (optimal string alignment) distance. */
export function editDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => {
    const row = new Array<number>(m + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[n][m];
}

/**
 * A spelling slip, not a memory error: one edit in a word of 5+ letters, as long
 * as the ending is intact (Spanish endings carry tense, person and number, so
 * "pierda" vs "pierde" is a different word, not a typo).
 */
export function isTypo(expectedNorm: string, givenNorm: string): boolean {
  if (expectedNorm.length < 5 || givenNorm.length < 4) return false;
  if (expectedNorm.slice(-1) !== givenNorm.slice(-1)) return false;
  return editDistance(expectedNorm, givenNorm) === 1;
}

/** Common Spanish function words: hidden last in cloze, never used as the only blank. */
export const STOPWORDS = new Set(
  (
    "a al and ante con contra de del desde e el ella ellas ellos en entre era es esta este esto " +
    "fue ha han hasta la las le les lo los mas me mi mis muy ni no nos o os para pero por que se " +
    "si sin sino sobre su sus te ti tu tus un una uno unos unas y ya yo vos vuestro vuestra"
  ).split(" "),
);

export function isContentWord(t: Token): boolean {
  return !STOPWORDS.has(t.norm) && t.norm.length > 2;
}
