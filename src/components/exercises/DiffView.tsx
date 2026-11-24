"use client";

import type { CompareResult, WordStatus } from "@/lib/engine/compare";

const STYLE: Record<WordStatus, string> = {
  correcta: "",
  forma: "underline decoration-dotted decoration-muted underline-offset-4",
  ortografia: "underline decoration-dotted decoration-brand underline-offset-4",
  sustituida: "bg-bad-soft text-bad rounded px-1",
  omitida: "bg-warn-soft text-warn rounded px-1",
  desordenada: "bg-move-soft text-move rounded px-1",
  agregada: "text-bad line-through opacity-80",
};

const CHIP: Record<WordStatus, string> = {
  correcta: "bg-ok-soft text-ok",
  forma: "bg-surface-2 text-muted",
  ortografia: "bg-brand-soft text-brand",
  sustituida: "bg-bad-soft text-bad",
  omitida: "bg-warn-soft text-warn",
  desordenada: "bg-move-soft text-move",
  agregada: "bg-bad-soft text-bad",
};

export const STATUS_LABEL: Record<WordStatus, string> = {
  correcta: "Correctas",
  forma: "Tilde, mayúscula o puntuación",
  ortografia: "Ortografía",
  sustituida: "Sustituidas",
  omitida: "Omitidas",
  desordenada: "Fuera de orden",
  agregada: "Agregadas",
};

/** Shows the original text with each word marked by what happened to it. */
export function DiffView({ result }: { result: CompareResult }) {
  const shown = (Object.keys(STATUS_LABEL) as WordStatus[]).filter((k) => result.counts[k] > 0);
  return (
    <div>
      <p className="scripture text-lg leading-9">
        {result.words.map((w, i) => {
          const title =
            w.status === "sustituida"
              ? `Escribiste «${w.given}»`
              : w.status === "forma" || w.status === "ortografia"
                ? `Escribiste «${w.given}»`
                : w.status === "agregada"
                  ? "Esta palabra no está en el texto"
                  : undefined;
          return (
            <span key={i}>
              <span className={STYLE[w.status]} title={title}>
                {w.status === "agregada" ? w.given : w.expected}
                {w.status === "sustituida" && <span className="ml-1 text-xs line-through opacity-70">{w.given}</span>}
              </span>{" "}
            </span>
          );
        })}
      </p>
      <ul className="mt-4 flex flex-wrap gap-2 text-xs">
        {shown.map((k) => (
          <li key={k} className={`rounded-full px-2.5 py-1 ${CHIP[k]}`}>
            {STATUS_LABEL[k]}: {result.counts[k]}
          </li>
        ))}
      </ul>
      {result.onlyFormIssues && (
        <p className="mt-3 text-sm text-ok">Solo hay diferencias de tildes, mayúsculas, puntuación u ortografía. No cuentan como errores de memoria.</p>
      )}
    </div>
  );
}
