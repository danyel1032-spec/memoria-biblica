"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BOOKS, BOOK_BY_ID } from "@/lib/bible/books";
import { formatReference, parseReference } from "@/lib/bible/reference";
import { getBook, passageText, searchBible, TRANSLATIONS } from "@/lib/bible/loader";
import { useBible } from "@/lib/hooks/useBible";
import { db } from "@/lib/db/db";
import { addVerse } from "@/lib/db/actions";
import type { VerseRef } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { ErrorBox, Loading, PageHeader } from "@/components/ui";

const TRANSLATION = TRANSLATIONS[0];

function Library() {
  const params = useSearchParams();
  const router = useRouter();
  const q = params.get("q") ?? "";
  const book = params.get("libro") ?? "";
  const chapter = Number(params.get("cap") ?? 0);
  const [input, setInput] = useState(q);
  const { bible, error, retry } = useBible(TRANSLATION.id);

  const [lastQ, setLastQ] = useState(q);
  if (lastQ !== q) {
    setLastQ(q);
    setInput(q);
  }

  const go = (p: Record<string, string>) => {
    const sp = new URLSearchParams(p);
    router.push(`/biblioteca/${sp.toString() ? `?${sp}` : ""}`);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return go({});
    const ref = parseReference(text);
    if (ref) {
      const p: Record<string, string> = { libro: ref.book, cap: String(ref.chapter) };
      if (ref.verseStart) p.v = `${ref.verseStart}-${ref.verseEnd}`;
      return go(p);
    }
    go({ q: text });
  };

  return (
    <div>
      <PageHeader title="Biblioteca" subtitle={`${TRANSLATION.name} · ${TRANSLATION.license}`} />
      <form onSubmit={submit} role="search" className="relative">
        <label htmlFor="buscar" className="sr-only">
          Buscar referencia o palabras
        </label>
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-muted" />
        <input
          id="buscar"
          className="input pl-10"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Juan 3:16, Sal 23, o palabras: «buen pastor»"
          enterKeyHint="search"
        />
      </form>

      <div className="mt-5">
        {error ? (
          <ErrorBox message={`${error} Si es la primera vez, necesitas conexión para descargar la Biblia; después funciona sin internet.`} onRetry={retry} />
        ) : !bible ? (
          <Loading label="Cargando la Biblia…" />
        ) : q ? (
          <SearchResults bible={bible} q={q} />
        ) : book && chapter ? (
          <ChapterView bible={bible} book={book} chapter={chapter} initial={params.get("v") ?? ""} go={go} />
        ) : book ? (
          <ChapterPicker bible={bible} book={book} go={go} />
        ) : (
          <BookPicker go={go} />
        )}
      </div>
    </div>
  );
}

type Go = (p: Record<string, string>) => void;
type BibleT = NonNullable<ReturnType<typeof useBible>["bible"]>;

function BookPicker({ go }: { go: Go }) {
  return (
    <div className="space-y-6">
      {(["AT", "NT"] as const).map((t) => (
        <section key={t}>
          <h2 className="mb-2 text-sm font-semibold text-muted">{t === "AT" ? "Antiguo Testamento" : "Nuevo Testamento"}</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {BOOKS.filter((b) => b.testament === t).map((b) => (
              <button key={b.id} onClick={() => go({ libro: b.id })} className="card min-h-12 px-2 py-2 text-sm font-medium">
                {b.name}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ChapterPicker({ bible, book, go }: { bible: BibleT; book: string; go: Go }) {
  const b = getBook(bible, book);
  if (!b) return <ErrorBox message="Ese libro no existe en esta traducción." />;
  return (
    <div>
      <button className="btn btn-ghost -ml-3 mb-2" onClick={() => go({})}>
        <Icon name="back" /> Libros
      </button>
      <h2 className="mb-3 text-xl font-bold">{BOOK_BY_ID.get(book)?.name}</h2>
      <div className="grid grid-cols-6 gap-2">
        {b.chapters.map((_, i) => (
          <button key={i} onClick={() => go({ libro: book, cap: String(i + 1) })} className="card h-12 font-medium tabular-nums">
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChapterView({ bible, book, chapter, initial, go }: { bible: BibleT; book: string; chapter: number; initial: string; go: Go }) {
  const b = getBook(bible, book);
  const verses = b?.chapters[chapter - 1];
  const parseSel = (s: string): [number, number] | null => {
    const m = s.match(/^(\d+)-(\d+)$/);
    return m ? [Number(m[1]), Number(m[2])] : null;
  };
  const [sel, setSel] = useState<[number, number] | null>(parseSel(initial));
  const [anchor, setAnchor] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastInitial, setLastInitial] = useState(initial);
  if (lastInitial !== initial) {
    setLastInitial(initial);
    setSel(parseSel(initial));
  }

  const inRepertoire = useLiveQuery(
    () => db.verses.where("[ref.book+ref.chapter+ref.verseStart]").between([book, chapter, 0], [book, chapter, 999]).toArray(),
    [book, chapter],
  );
  const owned = useMemo(() => {
    const s = new Set<number>();
    for (const v of inRepertoire ?? []) for (let k = v.ref.verseStart; k <= v.ref.verseEnd; k++) s.add(k);
    return s;
  }, [inRepertoire]);

  useEffect(() => {
    if (sel) document.getElementById(`v${sel[0]}`)?.scrollIntoView({ block: "center" });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!b || !verses) return <ErrorBox message="Ese capítulo no existe en esta traducción." />;

  const tap = (n: number) => {
    setMsg(null);
    if (anchor === null || !sel) {
      setSel([n, n]);
      setAnchor(n);
    } else if (sel[0] === n && sel[1] === n) {
      setSel(null);
      setAnchor(null);
    } else {
      setSel([Math.min(anchor, n), Math.max(anchor, n)]);
      setAnchor(null);
    }
  };

  const add = async (separate: boolean) => {
    if (!sel) return;
    setBusy(true);
    try {
      const refs: VerseRef[] = separate
        ? Array.from({ length: sel[1] - sel[0] + 1 }, (_, i) => ({ book, chapter, verseStart: sel[0] + i, verseEnd: sel[0] + i }))
        : [{ book, chapter, verseStart: sel[0], verseEnd: sel[1] }];
      let created = 0;
      for (const ref of refs) {
        const r = await addVerse({ ref, reference: formatReference(ref), text: passageText(bible, ref), translationId: bible.id, source: "biblioteca" });
        if (r.created) created++;
      }
      setMsg(
        created === 0
          ? "Ya estaba en tus versículos."
          : created === 1
            ? `Agregado ${refs.length === 1 ? formatReference(refs[0]) : "1 versículo"}. Aparecerá en tu próxima sesión.`
            : `Agregados ${created} versículos. Aparecerán en tus próximas sesiones.`,
      );
      setSel(null);
      setAnchor(null);
    } catch {
      setMsg("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };

  const ref = sel ? { book, chapter, verseStart: sel[0], verseEnd: sel[1] } : null;
  return (
    <div className={sel ? "pb-36" : ""}>
      <div className="mb-2 flex items-center justify-between">
        <button className="btn btn-ghost -ml-3" onClick={() => go({ libro: book })}>
          <Icon name="back" /> {BOOK_BY_ID.get(book)?.name}
        </button>
        <div className="flex gap-1">
          <button className="btn btn-secondary px-3" disabled={chapter <= 1} onClick={() => go({ libro: book, cap: String(chapter - 1) })} aria-label="Capítulo anterior">
            ‹
          </button>
          <button className="btn btn-secondary px-3" disabled={chapter >= b.chapters.length} onClick={() => go({ libro: book, cap: String(chapter + 1) })} aria-label="Capítulo siguiente">
            ›
          </button>
        </div>
      </div>
      <h2 className="text-xl font-bold">
        {BOOK_BY_ID.get(book)?.name} {chapter}
      </h2>
      <p className="mb-3 text-xs text-muted">Toca un versículo para elegirlo; toca otro para elegir todo el pasaje entre ambos.</p>
      {b.titles?.[String(chapter)] && <p className="scripture mb-2 text-sm text-muted italic">{b.titles[String(chapter)]}</p>}
      <ol className="scripture space-y-1 text-lg">
        {verses.map((t, i) => {
          const n = i + 1;
          const on = sel && n >= sel[0] && n <= sel[1];
          return (
            <li key={n} id={`v${n}`}>
              <button onClick={() => tap(n)} aria-pressed={!!on} className={`w-full rounded-lg px-2 py-1 text-left ${on ? "bg-brand-soft" : ""}`}>
                <sup className="mr-1 font-sans text-xs font-semibold text-gold">{n}</sup>
                {t}
                {owned.has(n) && (
                  <span className="ml-1 inline-flex align-middle text-ok" title="Ya está en tus versículos">
                    <Icon name="check" className="h-4 w-4" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {msg && (
        <div className="card fixed inset-x-4 bottom-24 z-30 mx-auto max-w-xl p-4 text-sm shadow-lg" role="status">
          {msg}{" "}
          <Link href="/versiculos/" className="font-semibold text-brand">
            Ver mis versículos
          </Link>
        </div>
      )}
      {ref && (
        <div className="fixed inset-x-0 bottom-[4.5rem] z-30 border-t border-line bg-surface p-3 pb-4 shadow-lg">
          <div className="mx-auto max-w-2xl">
            <p className="mb-2 text-sm font-semibold">{formatReference(ref)}</p>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" disabled={busy} onClick={() => add(false)}>
                <Icon name="plus" /> {sel![0] === sel![1] ? "Memorizar" : "Memorizar como pasaje"}
              </button>
              {sel![0] !== sel![1] && (
                <button className="btn btn-secondary" disabled={busy} onClick={() => add(true)}>
                  Por separado
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchResults({ bible, q }: { bible: BibleT; q: string }) {
  const { hits, total } = useMemo(() => searchBible(bible, q, 300), [bible, q]);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const keyOf = (r: VerseRef) => `${r.book}.${r.chapter}.${r.verseStart}`;
  const owned = useLiveQuery(async () => new Set((await db.verses.toArray()).map((v) => keyOf(v.ref))), []);

  if (hits.length === 0) return <p className="text-muted">No hay versículos con «{q}». Prueba con otra palabra o una referencia como «Juan 3:16».</p>;
  return (
    <div>
      <p className="mb-3 text-sm text-muted">
        {total} {total === 1 ? "versículo" : "versículos"} con «{q}»{total > hits.length ? ` (se muestran ${hits.length})` : ""}
      </p>
      <ul className="space-y-2">
        {hits.map((h) => {
          const k = keyOf(h.ref);
          const has = owned?.has(k) || added.has(k);
          return (
            <li key={k} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/biblioteca/?libro=${h.ref.book}&cap=${h.ref.chapter}&v=${h.ref.verseStart}-${h.ref.verseEnd}`} className="font-semibold text-brand">
                  {h.reference}
                </Link>
                <button
                  className={`btn ${has ? "btn-secondary" : "btn-primary"} min-h-9 px-3 text-sm`}
                  disabled={has}
                  onClick={async () => {
                    await addVerse({ ref: h.ref, reference: h.reference, text: h.text, translationId: bible.id, source: "biblioteca" });
                    setAdded((s) => new Set(s).add(k));
                  }}
                >
                  {has ? "Agregado" : "Memorizar"}
                </button>
              </div>
              <p className="scripture mt-1">{h.text}</p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Library />
    </Suspense>
  );
}
