"use client";

import Link from "next/link";
import { Icon } from "./Icon";
import type { Stage } from "@/lib/types";
import { STAGE_LABEL } from "@/lib/engine/mastery";

export function PageHeader({ title, subtitle, back }: { title: string; subtitle?: string; back?: string }) {
  return (
    <header className="mb-5 flex items-start gap-2">
      {back && (
        <Link href={back} className="-ml-2 mt-0.5 rounded-full p-2 text-muted" aria-label="Volver">
          <Icon name="back" className="h-6 w-6" />
        </Link>
      )}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
    </header>
  );
}

const STAGE_STYLE: Record<Stage, string> = {
  nuevo: "bg-surface-2 text-muted",
  aprendiendo: "bg-warn-soft text-warn",
  consolidando: "bg-brand-soft text-brand",
  dominado: "bg-ok-soft text-ok",
};

export function StageBadge({ stage }: { stage: Stage }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_STYLE[stage]}`}>{STAGE_LABEL[stage]}</span>;
}

export function Loading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card border-bad/40 bg-bad-soft p-4 text-sm text-bad" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="btn btn-secondary mt-3" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="card p-6 text-center">
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export function pct(x: number | null | undefined) {
  return x === null || x === undefined ? "—" : `${Math.round(x * 100)} %`;
}
