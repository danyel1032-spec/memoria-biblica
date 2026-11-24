// Converts a USFX file (e.g. Reina-Valera 1909, public domain) into the compact
// JSON format the app loads: { id, name, books: [{ id, name, chapters: string[][] }] }
// Usage: node scripts/build-bible.mjs <input.usfx.xml> <output.json> <id> "<name>"
import { readFileSync, writeFileSync } from "node:fs";

const [input, output, id, name] = process.argv.slice(2);
if (!input || !output || !id || !name) {
  console.error("Usage: node scripts/build-bible.mjs <input> <output> <id> <name>");
  process.exit(1);
}

const xml = readFileSync(input, "utf8");
const books = [];
const bookRe = /<book id="([A-Z0-9]+)">([\s\S]*?)<\/book>/g;
let m;
let total = 0;
while ((m = bookRe.exec(xml))) {
  const [, bookId, body] = m;
  const bookName = (body.match(/<h>([^<]+)<\/h>/) ?? [])[1]?.trim() ?? bookId;
  const chapters = [];
  const titles = {};
  const stanzas = {};
  // Split by chapter markers
  const parts = body.split(/<c id="(\d+)"\s*\/>/);
  for (let i = 1; i < parts.length; i += 2) {
    const chNum = Number(parts[i]);
    const chBody = parts[i + 1];
    const verses = [];
    const vRe = /<v id="(\d+)"\s*\/>([\s\S]*?)(?=<ve\s*\/>|<v id=|$)/g;
    let vm;
    while ((vm = vRe.exec(chBody))) {
      const vNum = Number(vm[1]);
      let raw = vm[2];
      // Psalm superscriptions ("Salmo de David.") are closed by </p> inside verse 1
      // and followed by the chapter-initial capitalised word. Keep them apart.
      if (vNum === 1) {
        const split = raw.match(/^([\s\S]*?)<\/p>([\s\S]*)$/);
        if (split && /^\s*(<[^>]+>\s*)*[A-ZÁÉÍÓÚÑÜ]{2,}/.test(split[2]) && clean(split[1])) {
          titles[chNum] = clean(split[1]);
          raw = split[2];
        }
      }
      let text = clean(raw);
      // Psalm 119 stanza letters ("Aleph. BIENAVENTURADOS ...") are headings.
      const stanza =
        bookId === "PSA" && chNum === 119 && (vNum - 1) % 8 === 0
          ? text.match(/^(Aleph|Beth|Gimel|Daleth|He|Vau|Zain|Cheth|Teth|Jod|Caph|Lamed|Mem|Nun|Samech|Ain|Pe|Tzaddi|Coph|Resh|Sin|Tau)\.?\s+/i)
          : null;
      if (stanza) {
        const letter = stanza[1][0].toUpperCase() + stanza[1].slice(1).toLowerCase();
        (stanzas[chNum] ??= {})[vNum] = letter;
        text = fixChapterInitialCaps(text.slice(stanza[0].length));
      }
      if (vNum === 1) text = fixChapterInitialCaps(text);
      verses[vNum - 1] = text;
      total++;
    }
    for (let k = 0; k < verses.length; k++) if (verses[k] === undefined) verses[k] = "";
    chapters[chNum - 1] = verses;
  }
  const book = { id: bookId, name: bookName, chapters };
  if (Object.keys(titles).length) book.titles = titles;
  if (Object.keys(stanzas).length) book.stanzas = stanzas;
  books.push(book);
}

function clean(s) {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

// Printed Bibles capitalise the first word of each chapter ("EN el principio",
// "JEHOVA es mi pastor"). That is typography, not text, so normalise it.
function fixChapterInitialCaps(text) {
  return text.replace(/^([A-ZÁÉÍÓÚÑÜ]{2,})(?=[\s,.;:])/, (w) => w[0] + w.slice(1).toLowerCase());
}

writeFileSync(output, JSON.stringify({ id, name, books }));
console.log(`${books.length} books, ${total} verses -> ${output}`);
