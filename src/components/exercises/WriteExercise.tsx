"use client";

import { useState } from "react";
import { compareText } from "@/lib/engine/compare";
import { tokenize } from "@/lib/text/normalize";
import { resultFromCompare, type ExerciseProps } from "./types";

/** E. Escribir de memoria: only the reference is shown. */
export function WriteExercise({ verse, onDone }: ExerciseProps) {
  const [text, setText] = useState("");
  const submit = () => {
    const c = compareText(verse.text, text);
    onDone(resultFromCompare(c, tokenize(verse.text).map((t) => t.norm)));
  };
  return (
    <div>
      <p className="text-sm text-muted">Escribe el texto completo sin mirarlo. Las tildes, mayúsculas y la puntuación no cuentan como error.</p>
      <label htmlFor="answer" className="sr-only">
        Tu respuesta
      </label>
      <textarea
        id="answer"
        className="input scripture mt-4 min-h-44 text-lg"
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
        autoCapitalize="sentences"
        spellCheck={false}
        placeholder="Escribe aquí lo que recuerdas…"
      />
      <div className="mt-4 flex gap-3">
        <button className="btn btn-primary flex-1" onClick={submit} disabled={!text.trim()}>
          Comprobar
        </button>
        <button className="btn btn-secondary" onClick={submit}>
          No lo recuerdo
        </button>
      </div>
    </div>
  );
}
