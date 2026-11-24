import { normalizeWord } from "@/lib/text/normalize";

export interface BookInfo {
  id: string;
  name: string;
  abbr: string;
  testament: "AT" | "NT";
  /** Extra ways people write the name (already normalised: lowercase, no accents). */
  aliases: string[];
}

const RAW: [string, string, string, string][] = [
  ["GEN", "Génesis", "Gn", "gen gn ge"],
  ["EXO", "Éxodo", "Éx", "ex exo exod"],
  ["LEV", "Levítico", "Lv", "lev lv"],
  ["NUM", "Números", "Nm", "num nm nu"],
  ["DEU", "Deuteronomio", "Dt", "deut dt deu"],
  ["JOS", "Josué", "Jos", "jos"],
  ["JDG", "Jueces", "Jue", "jue jc"],
  ["RUT", "Rut", "Rt", "rt"],
  ["1SA", "1 Samuel", "1 S", "1s 1sa 1sam"],
  ["2SA", "2 Samuel", "2 S", "2s 2sa 2sam"],
  ["1KI", "1 Reyes", "1 R", "1r 1re 1rey"],
  ["2KI", "2 Reyes", "2 R", "2r 2re 2rey"],
  ["1CH", "1 Crónicas", "1 Cr", "1cr 1cro"],
  ["2CH", "2 Crónicas", "2 Cr", "2cr 2cro"],
  ["EZR", "Esdras", "Esd", "esd"],
  ["NEH", "Nehemías", "Neh", "neh ne"],
  ["EST", "Ester", "Est", "est"],
  ["JOB", "Job", "Job", "jb"],
  ["PSA", "Salmos", "Sal", "sal salmo sl ps"],
  ["PRO", "Proverbios", "Pr", "pr prov pro"],
  ["ECC", "Eclesiastés", "Ec", "ec ecl"],
  ["SNG", "Cantares", "Cnt", "cnt cant cantar cantares cantar de los cantares"],
  ["ISA", "Isaías", "Is", "is isa"],
  ["JER", "Jeremías", "Jer", "jer jr"],
  ["LAM", "Lamentaciones", "Lm", "lm lam"],
  ["EZK", "Ezequiel", "Ez", "ez eze"],
  ["DAN", "Daniel", "Dn", "dn dan"],
  ["HOS", "Oseas", "Os", "os"],
  ["JOL", "Joel", "Jl", "jl"],
  ["AMO", "Amós", "Am", "am"],
  ["OBA", "Abdías", "Abd", "abd"],
  ["JON", "Jonás", "Jon", "jon"],
  ["MIC", "Miqueas", "Mi", "mi miq"],
  ["NAM", "Nahúm", "Nah", "nah nahum"],
  ["HAB", "Habacuc", "Hab", "hab"],
  ["ZEP", "Sofonías", "Sof", "sof"],
  ["HAG", "Hageo", "Hag", "hag"],
  ["ZEC", "Zacarías", "Zac", "zac"],
  ["MAL", "Malaquías", "Mal", "mal"],
  ["MAT", "Mateo", "Mt", "mt mat san mateo"],
  ["MRK", "Marcos", "Mr", "mr mc mar san marcos"],
  ["LUK", "Lucas", "Lc", "lc luc san lucas"],
  ["JHN", "Juan", "Jn", "jn jua san juan"],
  ["ACT", "Hechos", "Hch", "hch hech hechos de los apostoles"],
  ["ROM", "Romanos", "Ro", "ro rom rm"],
  ["1CO", "1 Corintios", "1 Co", "1co 1cor"],
  ["2CO", "2 Corintios", "2 Co", "2co 2cor"],
  ["GAL", "Gálatas", "Gá", "ga gal"],
  ["EPH", "Efesios", "Ef", "ef efe"],
  ["PHP", "Filipenses", "Fil", "fil flp"],
  ["COL", "Colosenses", "Col", "col"],
  ["1TH", "1 Tesalonicenses", "1 Ts", "1ts 1tes"],
  ["2TH", "2 Tesalonicenses", "2 Ts", "2ts 2tes"],
  ["1TI", "1 Timoteo", "1 Ti", "1ti 1tim"],
  ["2TI", "2 Timoteo", "2 Ti", "2ti 2tim"],
  ["TIT", "Tito", "Tit", "tit"],
  ["PHM", "Filemón", "Flm", "flm filem"],
  ["HEB", "Hebreos", "He", "he heb"],
  ["JAS", "Santiago", "Stg", "stg sant"],
  ["1PE", "1 Pedro", "1 P", "1p 1pe 1ped"],
  ["2PE", "2 Pedro", "2 P", "2p 2pe 2ped"],
  ["1JN", "1 Juan", "1 Jn", "1jn 1juan"],
  ["2JN", "2 Juan", "2 Jn", "2jn 2juan"],
  ["3JN", "3 Juan", "3 Jn", "3jn 3juan"],
  ["JUD", "Judas", "Jud", "jud"],
  ["REV", "Apocalipsis", "Ap", "ap apoc"],
];

export const BOOKS: BookInfo[] = RAW.map(([id, name, abbr, aliases], i) => ({
  id,
  name,
  abbr,
  testament: i < 39 ? "AT" : "NT",
  aliases: aliases.split(" ").map((a) => a.replace(/\s+/g, "")),
}));

export const BOOK_BY_ID = new Map(BOOKS.map((b) => [b.id, b]));

const key = (s: string) => normalizeWord(s).replace(/\s+/g, "").replace(/^(i{1,3})(?=[a-z])/, (r) => String(r.length));
const LOOKUP = new Map<string, BookInfo>();
for (const b of BOOKS) {
  LOOKUP.set(key(b.name), b);
  LOOKUP.set(key(b.abbr), b);
  for (const a of b.aliases) LOOKUP.set(a, b);
}

/** Finds a book from any common Spanish spelling or abbreviation. */
export function findBook(input: string): BookInfo | undefined {
  const k = key(input.replace(/\s+/g, ""));
  if (!k) return undefined;
  const exact = LOOKUP.get(k);
  if (exact) return exact;
  // Unique prefix of a full name ("filip", "apoca").
  const matches = BOOKS.filter((b) => key(b.name).startsWith(k));
  return matches.length === 1 ? matches[0] : undefined;
}
