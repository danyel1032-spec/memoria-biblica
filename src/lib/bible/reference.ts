import { BOOK_BY_ID, findBook } from "./books";
import type { VerseRef } from "@/lib/types";

export interface ParsedRef {
  book: string;
  chapter: number;
  /** Absent when only a chapter was given. */
  verseStart?: number;
  verseEnd?: number;
}

/**
 * Parses "Juan 3:16", "jn 3.16", "Sal 23", "1 Co 13:4-7", "Romanos 8:28–30".
 * Returns null when it does not look like a reference.
 */
export function parseReference(input: string): ParsedRef | null {
  const m = input
    .trim()
    .match(/^([1-3]?\s*[^\d:.,]+?)\s*(\d+)(?:\s*[:.,]\s*(\d+)(?:\s*[-–—]\s*(\d+))?)?\s*$/);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  const chapter = Number(m[2]);
  const verseStart = m[3] ? Number(m[3]) : undefined;
  const verseEnd = m[4] ? Number(m[4]) : verseStart;
  if (verseStart && verseEnd && verseEnd < verseStart) return null;
  return { book: book.id, chapter, verseStart, verseEnd };
}

export function formatReference(ref: VerseRef | ParsedRef): string {
  const name = BOOK_BY_ID.get(ref.book)?.name ?? ref.book;
  if (!ref.verseStart) return `${name} ${ref.chapter}`;
  const end = ref.verseEnd && ref.verseEnd !== ref.verseStart ? `-${ref.verseEnd}` : "";
  return `${name} ${ref.chapter}:${ref.verseStart}${end}`;
}
