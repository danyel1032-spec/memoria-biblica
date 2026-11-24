"use client";

import { useEffect, useRef, useState } from "react";
import { exportBackup, getSettings, importBackup, saveSettings, validateBackup } from "@/lib/db/db";
import { TRANSLATIONS } from "@/lib/bible/loader";
import type { Settings } from "@/lib/types";
import { Loading, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [backupMsg, setBackupMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then(setS);
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  if (!s) return <Loading />;

  const update = async (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    await saveSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const download = async () => {
    const data = await exportBackup();
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memoria-biblica-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMsg({ ok: true, text: `Copia descargada: ${data.verses.length} versículos y ${data.attempts.length} ejercicios.` });
  };

  const restore = async (f: File) => {
    try {
      const data: unknown = JSON.parse(await f.text());
      if (!validateBackup(data)) throw new Error();
      const r = await importBackup(data);
      setBackupMsg({ ok: true, text: `Restaurado: ${r.verses} versículos actualizados y ${r.attempts} ejercicios.` });
      getSettings().then(setS);
    } catch {
      setBackupMsg({ ok: false, text: "Ese archivo no es una copia de Memoria Bíblica válida." });
    }
  };

  return (
    <div>
      <PageHeader title="Ajustes" subtitle={saved ? "Guardado" : undefined} />

      <section className="card p-5">
        <h2 className="font-semibold">Ritmo de estudio</h2>
        <Range label="Versículos nuevos por día" value={s.newPerDay} min={0} max={10} step={1} onChange={(v) => update({ newPerDay: v })} format={(v) => String(v)} />
        <Range label="Máximo de repasos por sesión" value={s.maxReviewsPerSession} min={5} max={100} step={5} onChange={(v) => update({ maxReviewsPerSession: v })} format={(v) => String(v)} />
        <Range
          label="Retención objetivo"
          hint="Probabilidad de recordar un versículo cuando te toca repasarlo. Más alta significa repasos más frecuentes."
          value={s.retention}
          min={0.8}
          max={0.97}
          step={0.01}
          onChange={(v) => update({ retention: v })}
          format={(v) => `${Math.round(v * 100)} %`}
        />
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-semibold">Traducción</h2>
        {TRANSLATIONS.map((t) => (
          <div key={t.id} className="mt-2 text-sm">
            <p className="font-medium">
              {t.name} <span className="text-muted">· {t.license}</span>
            </p>
            <p className="text-muted">{t.note}</p>
          </div>
        ))}
        <p className="mt-3 text-xs text-muted">
          La RVR1960 pertenece a Sociedades Bíblicas Unidas y se añadirá solo con licencia. Mientras tanto, puedes escribir a mano los versículos de la
          Biblia que uses.
        </p>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="font-semibold">Tus datos</h2>
        <p className="mt-1 text-sm text-muted">
          Todo se guarda en este dispositivo y funciona sin conexión.{" "}
          {persisted === true
            ? "El navegador protege estos datos para no borrarlos."
            : persisted === false
              ? "El navegador podría borrarlos si se queda sin espacio: instala la app y descarga copias de seguridad."
              : ""}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button className="btn btn-primary" onClick={download}>
            Descargar copia de seguridad
          </button>
          <button className="btn btn-secondary" onClick={() => file.current?.click()}>
            Restaurar una copia
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) restore(f);
              e.target.value = "";
            }}
          />
        </div>
        {backupMsg && (
          <p className={`mt-3 text-sm ${backupMsg.ok ? "text-ok" : "text-bad"}`} role="status">
            {backupMsg.text}
          </p>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-muted">Memoria Bíblica · «Guarda la Palabra en tu corazón»</p>
    </div>
  );
}

function Range({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const id = label.replace(/\s+/g, "-");
  return (
    <div className="mt-4">
      <div className="flex justify-between text-sm">
        <label htmlFor={id} className="font-medium">
          {label}
        </label>
        <span className="tabular-nums">{format(value)}</span>
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <input id={id} type="range" className="mt-2 w-full accent-[var(--brand)]" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
