"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { deleteVerse, updateVerse } from "@/lib/db/actions";
import { TRANSLATIONS } from "@/lib/bible/loader";
import { formatDue, masteryProgress, MODE_LABEL, RATING_LABEL, retrievability } from "@/lib/engine/mastery";
import { LADDER, type Mode } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { Empty, Loading, StageBadge, pct } from "@/components/ui";

const PRACTICE: Mode[] = ["fragmentos", "completar", "elegir", "ordenar-palabras", "ordenar-frases", "escribir", "sin-pistas"];

function VerseCard() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const verse = useLiveQuery(() => db.verses.get(id), [id]);
  const attempts = useLiveQuery(() => db.attempts.where("verseId").equals(id).reverse().sortBy("date"), [id]);
  const [notes, setNotes] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saved, setSaved] = useState(false);

  if (verse && notes === null) setNotes(verse.notes);

  if (verse === undefined || attempts === undefined) return <Loading />;
  if (!verse)
    return (
      <Empty title="Este versículo ya no está en tu repertorio">
        <Link href="/versiculos/" className="btn btn-primary mt-4">
          Mis versículos
        </Link>
      </Empty>
    );

  const now = new Date();
  const translation = TRANSLATIONS.find((t) => t.id === verse.translationId);
  const r = retrievability(verse, now);
  const scheduled = verse.stage === "consolidando" || verse.stage === "dominado";
  const topErrors = Object.entries(verse.errorWords)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const recallAvg = verse.recallCount ? verse.recallAccuracySum / verse.recallCount : null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link href="/versiculos/" className="-ml-2 rounded-full p-2 text-muted" aria-label="Volver">
          <Icon name="back" className="h-6 w-6" />
        </Link>
        <button
          className={`rounded-full p-2 ${verse.favorite ? "text-gold" : "text-muted"}`}
          aria-pressed={verse.favorite}
          aria-label={verse.favorite ? "Quitar de favoritos" : "Marcar como favorito"}
          onClick={() => updateVerse(verse.id, { favorite: !verse.favorite })}
        >
          <Icon name="star" filled={verse.favorite} className="h-6 w-6" />
        </button>
      </div>

      <h1 className="text-2xl font-bold">{verse.reference}</h1>
      <p className="text-xs text-muted">{translation ? `${translation.name} · ${translation.license}` : verse.source === "manual" ? "Introducido a mano" : verse.translationId}</p>
      <p className="scripture mt-3 text-xl">{verse.text}</p>
      {verse.ref.book && (
        <Link href={`/biblioteca/?libro=${verse.ref.book}&cap=${verse.ref.chapter}&v=${verse.ref.verseStart}-${verse.ref.verseEnd}`} className="mt-2 inline-block text-sm font-semibold text-brand">
          Leer en su contexto (capítulo completo)
        </Link>
      )}

      <section className="card mt-5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Estado</h2>
          <StageBadge stage={verse.stage} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {verse.stage === "aprendiendo" || verse.stage === "nuevo"
            ? `Paso ${Math.min(verse.ladderStep + 1, LADDER.length)} de ${LADDER.length}: ${MODE_LABEL[LADDER[Math.min(verse.ladderStep, LADDER.length - 1)]]}.`
            : masteryProgress(verse)}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Item label="Agregado" value={new Date(verse.addedAt).toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" })} />
          <Item label="Ejercicios" value={String(verse.reviews)} />
          <Item label="Precisión sin ayudas" value={pct(recallAvg)} />
          <Item label="Última precisión" value={pct(verse.lastAccuracy)} />
          <Item label="Próxima evaluación" value={scheduled ? formatDue(new Date(verse.due), now) : "Tras el aprendizaje guiado"} />
          <Item label="Probabilidad de recordarlo hoy" value={r === null ? "—" : pct(r)} />
          {verse.stage === "aprendiendo" && <Item label="Palabras ocultas al completar" value={pct(verse.clozeLevel)} />}
          {verse.masteredAt && <Item label="Dominado desde" value={new Date(verse.masteredAt).toLocaleDateString("es-DO")} />}
        </dl>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-semibold">Practicar ahora</h2>
        <p className="mt-1 text-xs text-muted">Solo «Escribir de memoria» y «Recuperación sin pistas» cuentan para el dominio y el calendario.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {PRACTICE.map((m) => (
            <Link key={m} href={`/practicar/?id=${verse.id}&modo=${m}`} className="btn btn-secondary min-h-12 text-sm">
              {MODE_LABEL[m]}
            </Link>
          ))}
        </div>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-semibold">Errores frecuentes</h2>
        {topErrors.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Todavía no hay errores registrados.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {topErrors.map(([w, n]) => (
              <li key={w} className="rounded-full bg-bad-soft px-3 py-1 text-sm text-bad">
                {w} <span className="opacity-70">×{n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-semibold">Contexto y notas</h2>
        <p className="mt-1 text-xs text-muted">Escribe quién habla, a quién, en qué situación y qué significa para ti. Comprender ayuda a recordar.</p>
        <textarea
          className="input mt-3 min-h-28"
          value={notes ?? ""}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaved(false);
          }}
          aria-label="Contexto y notas"
        />
        <button
          className="btn btn-secondary mt-2"
          disabled={notes === verse.notes}
          onClick={async () => {
            await updateVerse(verse.id, { notes: notes ?? "" });
            setSaved(true);
          }}
        >
          {saved && notes === verse.notes ? "Guardado" : "Guardar notas"}
        </button>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-semibold">Historial</h2>
        {attempts.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Sin ejercicios todavía.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line text-sm">
            {attempts.slice(0, 40).map((a) => (
              <li key={a.id} className="py-2.5">
                <div className="flex justify-between gap-2">
                  <span>{MODE_LABEL[a.mode]}</span>
                  <span className="font-semibold tabular-nums">{pct(a.accuracy)}</span>
                </div>
                <div className="flex justify-between gap-2 text-xs text-muted">
                  <span>{new Date(a.date).toLocaleString("es-DO", { dateStyle: "medium", timeStyle: "short" })}</span>
                  {a.rating !== undefined && <span>{RATING_LABEL[a.rating]}</span>}
                </div>
                {a.errors.length > 0 && <p className="mt-1 text-xs text-bad">{a.errors.slice(0, 5).join(" · ")}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6">
        {!confirmDelete ? (
          <button className="btn text-bad" onClick={() => setConfirmDelete(true)}>
            <Icon name="trash" /> Quitar de mi repertorio
          </button>
        ) : (
          <div className="card border-bad/40 p-4">
            <p className="text-sm">Se borrarán este versículo y todo su historial de este dispositivo. No se puede deshacer.</p>
            <div className="mt-3 flex gap-2">
              <button
                className="btn bg-bad text-white"
                onClick={async () => {
                  await deleteVerse(verse.id);
                  router.replace("/versiculos/");
                }}
              >
                Sí, quitar
              </button>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

export default function VersePage() {
  return (
    <Suspense fallback={<Loading />}>
      <VerseCard />
    </Suspense>
  );
}
