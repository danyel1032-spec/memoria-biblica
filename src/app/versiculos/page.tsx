"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/db";
import { formatDue, STAGE_LABEL } from "@/lib/engine/mastery";
import { stripAccents } from "@/lib/text/normalize";
import type { Stage } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { Empty, Loading, PageHeader, StageBadge, pct } from "@/components/ui";

const FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Todos" },
  { key: "favoritos", label: "Favoritos" },
  ...(Object.keys(STAGE_LABEL) as Stage[]).map((s) => ({ key: s, label: STAGE_LABEL[s] })),
];

function MyVerses() {
  const params = useSearchParams();
  const router = useRouter();
  const filter = params.get("estado") ?? "";
  const [text, setText] = useState("");
  const verses = useLiveQuery(() => db.verses.orderBy("addedAt").reverse().toArray(), []);

  if (!verses) return <Loading />;
  const q = stripAccents(text.trim().toLowerCase());
  const list = verses.filter(
    (v) =>
      (filter === "" || (filter === "favoritos" ? v.favorite : v.stage === filter)) &&
      (!q || stripAccents(`${v.reference} ${v.text}`.toLowerCase()).includes(q)),
  );
  const now = new Date();

  return (
    <div>
      <PageHeader title="Mis versículos" subtitle={`${verses.length} en tu repertorio`} />
      <div className="flex gap-2">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Filtrar por referencia o palabra" aria-label="Filtrar" />
        <Link href="/agregar/" className="btn btn-primary shrink-0" aria-label="Agregar versículo">
          <Icon name="plus" />
        </Link>
      </div>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button key={f.key} className="chip shrink-0" aria-pressed={filter === f.key} onClick={() => router.replace(`/versiculos/${f.key ? `?estado=${f.key}` : ""}`)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {verses.length === 0 ? (
          <Empty title="Aún no tienes versículos">
            <Link href="/biblioteca/" className="btn btn-primary mt-4">
              Ir a la Biblioteca
            </Link>
          </Empty>
        ) : list.length === 0 ? (
          <Empty title="Ningún versículo coincide con el filtro" />
        ) : (
          <ul className="space-y-2">
            {list.map((v) => (
              <li key={v.id}>
                <Link href={`/versiculo/?id=${v.id}`} className="card block p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-semibold">
                      {v.favorite && <Icon name="star" filled className="h-4 w-4 text-gold" />}
                      {v.reference}
                    </span>
                    <StageBadge stage={v.stage} />
                  </div>
                  <p className="scripture mt-1 line-clamp-2 text-muted">{v.text}</p>
                  <p className="mt-2 text-xs text-muted">
                    {v.stage === "consolidando" || v.stage === "dominado"
                      ? `Próximo repaso: ${formatDue(new Date(v.due), now)} · última precisión ${pct(v.lastAccuracy)}`
                      : v.stage === "aprendiendo"
                        ? "En aprendizaje guiado"
                        : "Se introducirá en tu sesión diaria"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function MyVersesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <MyVerses />
    </Suspense>
  );
}
