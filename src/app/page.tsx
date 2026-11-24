"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getSettings } from "@/lib/db/db";
import { localDay, streakFrom } from "@/lib/db/actions";
import { buildSession } from "@/lib/engine/session";
import { RECALL_MODES } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { Loading, pct } from "@/components/ui";

export default function HomePage() {
  const data = useLiveQuery(async () => {
    const [verses, attempts, settings] = await Promise.all([db.verses.toArray(), db.attempts.orderBy("date").toArray(), getSettings()]);
    const now = new Date();
    const today = localDay(now);
    const startedToday = new Set(
      attempts.filter((a) => a.stageBefore === "nuevo" && localDay(new Date(a.date)) === today).map((a) => a.verseId),
    ).size;
    const plan = buildSession(verses, {
      now,
      newPerDay: settings.newPerDay,
      startedToday,
      maxReviews: settings.maxReviewsPerSession,
      retention: settings.retention,
    });
    const monthAgo = Date.now() - 30 * 86_400_000;
    const recall = attempts.filter((a) => RECALL_MODES.includes(a.mode) && new Date(a.date).getTime() > monthAgo);
    const recallAvg = recall.length ? recall.reduce((s, a) => s + a.accuracy, 0) / recall.length : null;
    const doneToday = attempts.filter((a) => localDay(new Date(a.date)) === today).length;
    return {
      verses,
      plan,
      streak: streakFrom(attempts.map((a) => a.date)),
      recallAvg,
      doneToday,
      counts: {
        nuevo: verses.filter((v) => v.stage === "nuevo").length,
        aprendiendo: verses.filter((v) => v.stage === "aprendiendo").length,
        consolidando: verses.filter((v) => v.stage === "consolidando").length,
        dominado: verses.filter((v) => v.stage === "dominado").length,
      },
    };
  }, []);

  if (!data) return <Loading />;
  const { plan, verses, counts } = data;

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm font-semibold tracking-wide text-gold">MEMORIA BÍBLICA</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Guarda la Palabra en tu corazón</h1>
      </header>

      {verses.length === 0 ? (
        <div className="card p-6">
          <p className="text-lg font-semibold">Empieza eligiendo qué memorizar</p>
          <p className="mt-2 text-sm text-muted">
            Busca un versículo o pasaje en la Biblioteca, o escríbelo tú. La app te enseñará por pasos y te dirá cuándo repasar para no olvidarlo.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link href="/biblioteca/" className="btn btn-primary">
              <Icon name="search" /> Buscar en la Biblioteca
            </Link>
            <Link href="/agregar/" className="btn btn-secondary">
              <Icon name="plus" /> Escribir un versículo
            </Link>
          </div>
        </div>
      ) : (
        <>
          <section className="card p-5">
            <h2 className="text-lg font-semibold">Sesión de hoy</h2>
            {plan.items.length > 0 ? (
              <>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {plan.dueCount > 0 && <li>{plan.dueCount} {plan.dueCount === 1 ? "repaso pendiente" : "repasos pendientes"}</li>}
                  {plan.learningCount > 0 && <li>{plan.learningCount} en aprendizaje</li>}
                  {plan.newCount > 0 && <li>{plan.newCount} {plan.newCount === 1 ? "versículo nuevo" : "versículos nuevos"}</li>}
                  {plan.cumulativeCount > 0 && <li>{plan.cumulativeCount} de repaso acumulativo (versículos anteriores)</li>}
                </ul>
                <Link href="/sesion/" className="btn btn-primary mt-5 w-full text-lg">
                  Empezar sesión
                </Link>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                No hay nada pendiente por ahora. {counts.nuevo === 0 && "Agrega versículos nuevos en la Biblioteca cuando quieras."}
              </p>
            )}
          </section>

          <section className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="Días seguidos" value={String(data.streak)} icon="flame" />
            <Stat label="Ejercicios hoy" value={String(data.doneToday)} />
            <Stat label="Precisión sin ayudas (30 días)" value={pct(data.recallAvg)} />
          </section>

          <section className="card mt-4 p-5">
            <h2 className="text-lg font-semibold">Tu repertorio</h2>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {(
                [
                  ["nuevo", "Nuevos"],
                  ["aprendiendo", "Aprendiendo"],
                  ["consolidando", "Consolidando"],
                  ["dominado", "Dominados"],
                ] as const
              ).map(([k, label]) => (
                <Link key={k} href={`/versiculos/?estado=${k}`} className="rounded-xl bg-surface-2 p-2">
                  <p className="text-2xl font-bold tabular-nums">{counts[k]}</p>
                  <p className="text-[11px] leading-tight text-muted">{label}</p>
                </Link>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              Un versículo queda dominado solo cuando lo recuerdas sin ayudas, con 95 % o más, en tres evaluaciones de días distintos a lo largo de al
              menos tres semanas.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <div className="card p-3">
      <p className="flex items-center gap-1 text-2xl font-bold tabular-nums">
        {icon && <Icon name={icon} className="h-5 w-5 text-gold" />}
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted">{label}</p>
    </div>
  );
}
