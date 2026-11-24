"use client";

import Link from "next/link";
import { useState } from "react";
import { formatReference, parseReference } from "@/lib/bible/reference";
import { getBook, loadBible, passageText } from "@/lib/bible/loader";
import { addVerse } from "@/lib/db/actions";
import type { VerseRef } from "@/lib/types";
import { PageHeader } from "@/components/ui";

const MAX_TEXT = 4000;

/** Resolves a parsed reference into a full VerseRef using the Bible (whole chapter if no verses). */
async function resolve(input: string): Promise<{ ref: VerseRef; text: string; reference: string } | string> {
  const p = parseReference(input);
  if (!p) return `No reconozco «${input}» como referencia.`;
  const bible = await loadBible("rv1909");
  const ch = getBook(bible, p.book)?.chapters[p.chapter - 1];
  if (!ch) return `${formatReference(p)} no existe.`;
  const ref: VerseRef = { book: p.book, chapter: p.chapter, verseStart: p.verseStart ?? 1, verseEnd: Math.min(p.verseEnd ?? ch.length, ch.length) };
  if (ref.verseStart > ch.length) return `${formatReference(p)} no existe (el capítulo tiene ${ch.length} versículos).`;
  return { ref, text: passageText(bible, ref), reference: formatReference(ref) };
}

export default function AddPage() {
  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [list, setList] = useState("");
  const [report, setReport] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const fetchText = async () => {
    setMsg(null);
    try {
      const r = await resolve(reference);
      if (typeof r === "string") return setMsg({ ok: false, text: r });
      setReference(r.reference);
      setText(r.text);
    } catch {
      setMsg({ ok: false, text: "No se pudo cargar la Biblia. Revisa tu conexión la primera vez." });
    }
  };

  const saveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const refText = reference.trim();
    const body = text.trim().replace(/\s+/g, " ");
    if (!refText) return setMsg({ ok: false, text: "Escribe la referencia (por ejemplo, Juan 3:16)." });
    if (body.split(" ").length < 2) return setMsg({ ok: false, text: "Escribe el texto completo del versículo." });
    if (body.length > MAX_TEXT) return setMsg({ ok: false, text: "El texto es demasiado largo. Divídelo en pasajes más cortos." });
    setBusy(true);
    const p = parseReference(refText);
    const ref: VerseRef = p
      ? { book: p.book, chapter: p.chapter, verseStart: p.verseStart ?? 1, verseEnd: p.verseEnd ?? p.verseStart ?? 1 }
      : { book: "", chapter: 0, verseStart: 0, verseEnd: 0 };
    // Manual text may come from any translation the user owns: stored as "manual".
    const r = await addVerse({ ref, reference: p ? formatReference(ref) : refText, text: body, translationId: "manual", source: "manual" });
    setBusy(false);
    setMsg({ ok: true, text: r.created ? `${r.verse.reference} agregado.` : "Ya estaba en tus versículos." });
    if (r.created) {
      setReference("");
      setText("");
    }
  };

  const importList = async () => {
    setBusy(true);
    const lines = list
      .split(/\n|;/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 200);
    const out: string[] = [];
    for (const line of lines) {
      try {
        const r = await resolve(line);
        if (typeof r === "string") {
          out.push(`✗ ${r}`);
          continue;
        }
        const a = await addVerse({ ...r, translationId: "rv1909", source: "importado" });
        out.push(a.created ? `✓ ${r.reference}` : `• ${r.reference} ya estaba`);
      } catch {
        out.push(`✗ ${line}: no se pudo cargar el texto`);
      }
    }
    setReport(out);
    setBusy(false);
  };

  return (
    <div>
      <PageHeader title="Agregar versículos" back="/versiculos/" />

      <form onSubmit={saveManual} className="card p-5">
        <h2 className="font-semibold">Escribir un versículo</h2>
        <p className="mt-1 text-xs text-muted">
          Puedes traer el texto de la Reina-Valera 1909 o escribirlo tú desde la Biblia que uses. Si lo escribes tú, se guarda tal cual en tu dispositivo.
        </p>
        <label className="mt-4 block text-sm font-medium" htmlFor="ref">
          Referencia
        </label>
        <div className="mt-1 flex gap-2">
          <input id="ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ej.: Filipenses 4:13" />
          <button type="button" className="btn btn-secondary shrink-0" onClick={fetchText} disabled={!parseReference(reference)}>
            Traer texto
          </button>
        </div>
        <label className="mt-4 block text-sm font-medium" htmlFor="texto">
          Texto
        </label>
        <textarea id="texto" className="input scripture mt-1 min-h-32 text-lg" value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_TEXT} />
        {msg && (
          <p className={`mt-3 text-sm ${msg.ok ? "text-ok" : "text-bad"}`} role="status">
            {msg.text}{" "}
            {msg.ok && (
              <Link href="/versiculos/" className="font-semibold text-brand">
                Ver mis versículos
              </Link>
            )}
          </p>
        )}
        <button className="btn btn-primary mt-4 w-full" disabled={busy}>
          Guardar
        </button>
      </form>

      <section className="card mt-4 p-5">
        <h2 className="font-semibold">Importar una lista</h2>
        <p className="mt-1 text-xs text-muted">Una referencia por línea. Ejemplo: «Juan 3:16», «Sal 23:1-6», «Ro 8:28». El texto se toma de la Reina-Valera 1909.</p>
        <textarea className="input mt-3 min-h-32" value={list} onChange={(e) => setList(e.target.value)} aria-label="Lista de referencias" placeholder={"Juan 3:16\nSal 23:1-6\nRomanos 8:28"} />
        <button className="btn btn-primary mt-3 w-full" onClick={importList} disabled={busy || !list.trim()}>
          {busy ? "Importando…" : "Importar"}
        </button>
        {report && (
          <ul className="mt-3 space-y-1 text-sm">
            {report.map((r, i) => (
              <li key={i} className={r.startsWith("✗") ? "text-bad" : r.startsWith("✓") ? "text-ok" : "text-muted"}>
                {r}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
