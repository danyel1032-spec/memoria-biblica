"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { db } from "@/lib/db/db";
import type { LearningVerse, Mode } from "@/lib/types";
import { PracticeRunner } from "@/components/PracticeRunner";
import { Icon } from "@/components/Icon";
import { Empty, Loading } from "@/components/ui";
import { MODE_LABEL } from "@/lib/engine/mastery";

const MODES = Object.keys(MODE_LABEL).filter((m) => m !== "voz") as Mode[];

function Practice() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id") ?? "";
  const mode = (MODES.includes(params.get("modo") as Mode) ? params.get("modo") : "escribir") as Mode;
  const [verse, setVerse] = useState<LearningVerse | null | undefined>(undefined);

  useEffect(() => {
    db.verses.get(id).then((v) => setVerse(v ?? null));
  }, [id]);

  if (verse === undefined) return <Loading />;
  if (verse === null)
    return (
      <Empty title="No encontramos este versículo">
        <Link href="/versiculos/" className="btn btn-primary mt-4">
          Ver mis versículos
        </Link>
      </Empty>
    );

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Link href={`/versiculo/?id=${verse.id}`} className="-ml-2 rounded-full p-2 text-muted" aria-label="Cerrar">
          <Icon name="close" className="h-6 w-6" />
        </Link>
        <span className="text-sm text-muted">Práctica libre</span>
      </div>
      <PracticeRunner verse={verse} mode={mode} onNext={() => router.push(`/versiculo/?id=${verse.id}`)} nextLabel="Volver a la ficha" />
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<Loading />}>
      <Practice />
    </Suspense>
  );
}
