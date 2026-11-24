"use client";

import { useMemo, useState } from "react";
import { compareText, type CompareResult } from "@/lib/engine/compare";
import { splitFragments } from "@/lib/engine/fragments";
import { RULES } from "@/lib/engine/mastery";
import { tokenize } from "@/lib/text/normalize";
import { DiffView } from "./DiffView";
import { resultFromCompare, type ExerciseProps } from "./types";

type Phase = "leer" | "escribir" | "revisar" | "unir";

/**
 * A. Aprender por fragmentos: read a phrase, hide it, write it. Each phrase must
 * reach the pass mark before moving on. Then the whole text is written at once.
 */
export function FragmentExercise({ verse, onDone }: ExerciseProps) {
  const fragments = useMemo(() => splitFragments(verse.text), [verse.text]);
  const [k, setK] = useState(0);
  const [phase, setPhase] = useState<Phase>(fragments.length > 1 ? "leer" : "unir");
  const [answer, setAnswer] = useState("");
  const [last, setLast] = useState<CompareResult | null>(null);
  const [tries, setTries] = useState(0);

  const current = fragments[k];
  const passed = last ? last.accuracy >= RULES.stepPass : false;

  const check = () => {
    const c = compareText(current.text, answer);
    setLast(c);
    setTries((t) => t + 1);
    setPhase("revisar");
  };

  const next = () => {
    setAnswer("");
    setLast(null);
    if (!passed) {
      setPhase("leer");
      return;
    }
    setTries(0);
    if (k + 1 < fragments.length) {
      setK(k + 1);
      setPhase("leer");
    } else setPhase("unir");
  };

  const finishJoin = () => {
    const c = compareText(verse.text, answer);
    onDone(resultFromCompare(c, tokenize(verse.text).map((t) => t.norm)));
  };

  if (phase === "unir") {
    return (
      <div>
        <p className="text-sm font-semibold text-brand">{fragments.length > 1 ? "Ahora únelos" : "Escribe el texto"}</p>
        <p className="mt-1 text-sm text-muted">Escribe el texto completo de memoria.</p>
        <textarea
          className="input scripture mt-4 min-h-40 text-lg"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          autoFocus
          spellCheck={false}
          aria-label="Texto completo"
        />
        <button className="btn btn-primary mt-4 w-full" onClick={finishJoin} disabled={!answer.trim()}>
          Comprobar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1.5" aria-label={`Fragmento ${k + 1} de ${fragments.length}`}>
        {fragments.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < k ? "bg-ok" : i === k ? "bg-brand" : "bg-line"}`} />
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">
        Fragmento {k + 1} de {fragments.length}
      </p>

      <p className="scripture mt-4 text-lg">
        {fragments.map((f, i) => (
          <span key={i} className={i < k ? "text-muted" : i === k ? "" : "text-muted/40"}>
            {i < k ? f.text : i === k ? (phase === "leer" ? <mark className="rounded bg-brand-soft px-1 text-ink">{f.text}</mark> : <span className="rounded bg-surface-2 px-1 text-muted">{"＿ ".repeat(f.end - f.start).trim()}</span>) : "…"}{" "}
          </span>
        ))}
      </p>

      {phase === "leer" && (
        <>
          <p className="mt-4 text-sm text-muted">Lee el fragmento resaltado en voz alta dos o tres veces. Luego se ocultará.</p>
          <button className="btn btn-primary mt-4 w-full" onClick={() => setPhase("escribir")}>
            Ocultar y escribirlo
          </button>
        </>
      )}

      {phase === "escribir" && (
        <>
          <input
            className="input scripture mt-4 text-lg"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && answer.trim() && check()}
            autoFocus
            spellCheck={false}
            aria-label="Escribe el fragmento"
            placeholder="Escribe el fragmento oculto"
          />
          <button className="btn btn-primary mt-4 w-full" onClick={check} disabled={!answer.trim()}>
            Comprobar
          </button>
        </>
      )}

      {phase === "revisar" && last && (
        <div className="mt-4">
          <div className={`card p-4 ${passed ? "border-ok/40" : "border-warn/40"}`}>
            <p className={`mb-2 text-sm font-semibold ${passed ? "text-ok" : "text-warn"}`}>
              {passed ? "¡Bien!" : `Aún no (${Math.round(last.accuracy * 100)} %). Léelo otra vez.`}
            </p>
            <DiffView result={last} />
          </div>
          <button className="btn btn-primary mt-4 w-full" onClick={next} autoFocus>
            {passed ? (k + 1 < fragments.length ? "Siguiente fragmento" : "Unir los fragmentos") : `Repetir (intento ${tries + 1})`}
          </button>
        </div>
      )}
    </div>
  );
}
