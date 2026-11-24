import { normalizeWord, stripAccents } from "@/lib/text/normalize";
import { buildVocabulary, type Vocabulary } from "@/lib/engine/exercises";
import { BOOK_BY_ID } from "./books";
import { formatReference } from "./reference";
import type { VerseRef } from "@/lib/types";

export interface BibleBook {
  id: string;
  name: string;
  chapters: string[][];
  titles?: Record<string, string>;
}

export interface Bible {
  id: string;
  name: string;
  books: BibleBook[];
}

/** Translations bundled with the app. Only public domain or licensed texts go here. */
export const TRANSLATIONS = [
  {
    id: "rv1909",
    name: "Reina-Valera 1909",
    short: "RV1909",
    license: "Dominio público",
    note: "Conserva la ortografía de 1909 («á», «fué»). Al evaluar, las tildes no cuentan como error.",
  },
] as const;

const cache = new Map<string, Promise<Bible>>();

export function loadBible(id = "rv1909"): Promise<Bible> {
  if (!cache.has(id)) {
    const p = fetch(`/bibles/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar la traducción (${r.status}).`);
      return r.json() as Promise<Bible>;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id)!;
}

export function getBook(bible: Bible, bookId: string) {
  return bible.books.find((b) => b.id === bookId);
}

export interface PassageVerse {
  verse: number;
  text: string;
}

export function getPassage(bible: Bible, ref: VerseRef): PassageVerse[] {
  const chapter = getBook(bible, ref.book)?.chapters[ref.chapter - 1];
  if (!chapter) return [];
  const out: PassageVerse[] = [];
  for (let v = ref.verseStart; v <= Math.min(ref.verseEnd, chapter.length); v++) {
    out.push({ verse: v, text: chapter[v - 1] });
  }
  return out;
}

export function passageText(bible: Bible, ref: VerseRef): string {
  return getPassage(bible, ref)
    .map((p) => p.text)
    .join(" ");
}

export interface SearchHit {
  ref: VerseRef;
  reference: string;
  text: string;
}

/** Word or phrase search across the whole Bible, ignoring accents and capitals. */
export function searchBible(bible: Bible, query: string, limit = 200): { hits: SearchHit[]; total: number } {
  const q = stripAccents(query).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2) return { hits: [], total: 0 };
  const words = q.split(" ");
  const hits: SearchHit[] = [];
  let total = 0;
  for (const b of bible.books) {
    b.chapters.forEach((ch, ci) =>
      ch.forEach((text, vi) => {
        const norm = " " + stripAccents(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ") + " ";
        const ok = words.length > 1 ? norm.includes(" " + q + " ") || words.every((w) => norm.includes(" " + w + " ")) : norm.includes(" " + q + " ");
        if (!ok) return;
        total++;
        if (hits.length < limit) {
          const ref = { book: b.id, chapter: ci + 1, verseStart: vi + 1, verseEnd: vi + 1 };
          hits.push({ ref, reference: formatReference(ref), text });
        }
      }),
    );
  }
  // Exact phrase matches first.
  if (words.length > 1) {
    const phrase = (h: SearchHit) => (` ${normalizeWord(h.text)} `.includes(q) ? 0 : 1);
    hits.sort((a, b) => phrase(a) - phrase(b));
  }
  return { hits, total };
}

const vocabCache = new Map<string, Vocabulary>();
export function getVocabulary(bible: Bible): Vocabulary {
  if (!vocabCache.has(bible.id)) {
    vocabCache.set(bible.id, buildVocabulary(bible.books.flatMap((b) => b.chapters.flat())));
  }
  return vocabCache.get(bible.id)!;
}

export function bookName(id: string) {
  return BOOK_BY_ID.get(id)?.name ?? id;
}
