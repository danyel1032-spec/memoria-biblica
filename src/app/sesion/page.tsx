"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, getSettings } from "@/lib/db/db";
import { localDay } from "@/lib/db/actions";
import { buildSession, learningModeFor, type SessionItem } from "@/lib/engine/session";
import type { LearningVerse } from "@/lib/types";
import { PracticeRunner, type RunnerDone } from "@/components/PracticeRunner";
import { Icon } from "@/components/Icon";
import { Empty, Loading, StageBadge } from "@/components/ui";

interface Done {
  item: SessionItem;
  reference: string;
  accuracy: number;
  verse: LearningVerse;
}

const MAX_PER_VERSE = 7;

export default function SessionPage() {
  const [queue, setQueue] = useState<SessionItem[] | null>(null);
  const [pos, setPos] = useState(0);
  const [log, setLog] = useState<Done[]>([]);
  const [perVerse, setPerVerse] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      const [verses, attempts, settings] = await Promise.all([db.verses.toArray(), db.attempts.toArray(), getSettings()]);
      const today = localDay(new Date());
      const startedToday = new Set(attempts.filter((a) => a.stageBefore === "nuevo" && localDay(new Date(a.date)) === today).map((a) => a.verseId)).size;
      const plan = buildSession(verses, {
        now: new Date(),
        newPerDay: settings.newPerDay,
        startedToday,
        maxReviews: settings.maxReviewsPerSession,
        retention: settings.retention,
      });
      setQueue(plan.items);
    })();
  }, []);

  const item = queue?.[pos];
  const verse = useLiveQuery(() => (item ? db.verses.get(item.verseId) : undefined), [item?.verseId, pos]);

  if (!queue) return <Loading label="Preparando tu sesión…" />;

  const next = (d: RunnerDone | null) => {
    if (!item) return;
    const q = [...queue];
    if (d) {
      const count = (perVerse[item.verseId] ?? 0) + 1;
      setPerVerse((p) => ({ ...p, [item.verseId]: count }));
      setLog((l) => [...l, { item, reference: d.outcome.verse.reference, accuracy: d.result.accuracy, verse: d.outcome.verse }]);
      const v = d.outcome.verse;
      const insertAt = Math.min(q.length, pos + 3);
      if (count < MAX_PER_VERSE) {
        if (item.kind === "aprender" && v.stage === "aprendiendo") {
          // Spaced within the session: other verses come in between.
          q.splice(insertAt, 0, { verseId: v.id, kind: "aprender", mode: learningModeFor(v) });
        } else if (item.kind !== "aprender" && d.result.accuracy < 0.7) {
          // Weak recall: guided reinforcement later in the session.
          q.splice(insertAt, 0, { verseId: v.id, kind: item.kind, mode: "completar" });
        }
      }
    }
    setQueue(q);
    setPos(pos + 1);
  };

  if (queue.length === 0)
    return (
      <div className="pt-6">
        <Empty title="No hay nada pendiente ahora">
          <Link href="/" className="btn btn-primary mt-4">
            Volver al inicio
          </Link>
        </Empty>
      </div>
    );

  if (pos >= queue.length) {
    const avg = log.length ? log.reduce((s, x) => s + x.accuracy, 0) / log.length : 0;
    const byVerse = new Map<string, Done>();
    for (const d of log) byVerse.set(d.verse.id, d);
    return (
      <div className="pt-4">
        <h1 className="text-3xl font-bold">Sesión completada</h1>
        <p className="mt-2 text-muted">
          {log.length} ejercicios · precisión media {Math.round(avg * 100)} %
        </p>
        <ul className="mt-5 space-y-2">
          {[...byVerse.values()].map((d) => (
            <li key={d.verse.id}>
              <Link href={`/versiculo/?id=${d.verse.id}`} className="card flex items-center justify-between p-4">
                <span className="font-medium">{d.reference}</span>
                <StageBadge stage={d.verse.stage} />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/" className="btn btn-primary mt-6 w-full">
          Terminar
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center gap-3">
        <Link href="/" className="-ml-2 rounded-full p-2 text-muted" aria-label="Salir de la sesión">
          <Icon name="close" className="h-6 w-6" />
        </Link>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={queue.length} aria-valuenow={pos}>
          <div className="h-full bg-brand transition-all" style={{ width: `${(pos / queue.length) * 100}%` }} />
        </div>
        <span className="text-sm text-muted tabular-nums">
          {pos + 1}/{queue.length}
        </span>
      </div>
      {item && (
        <p className="mb-2 text-xs text-muted">
          {item.kind === "repaso" ? "Repaso programado" : item.kind === "acumulativo" ? "Repaso acumulativo" : "Aprendiendo"}
          {item.mode === "completar" && item.kind !== "aprender" ? " · refuerzo guiado" : ""}
        </p>
      )}
      {!verse ? (
        <Loading />
      ) : (
        <PracticeRunner key={`${pos}-${verse.id}`} verse={verse} mode={item!.mode} onNext={next} nextLabel="Continuar" />
      )}
    </div>
  );
}
