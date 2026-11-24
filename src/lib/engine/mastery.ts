import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from "ts-fsrs";
import { LADDER, RECALL_MODES, type LearningVerse, type MasteryEvidence, type Mode, type Stage } from "@/lib/types";

/** Thresholds of the memorisation engine. */
export const RULES = {
  /** Accuracy needed to pass a learning step. */
  stepPass: 0.9,
  /** "Completar" passes only once this share of words is hidden. */
  clozeLevelToPass: 0.6,
  /** No-help recall accuracy that counts as a correct retrieval. */
  masteryAccuracy: 0.95,
  /** Correct no-help recalls, on different days, needed for mastery. */
  masteryRecalls: 3,
  /** Days between first and last of those recalls (proves long-term retention). */
  masterySpanDays: 21,
  /** Below this, a mastered verse goes back to consolidation. */
  lapseAccuracy: 0.8,
};

export function scheduler(retention = 0.9) {
  return fsrs(
    generatorParameters({
      request_retention: retention,
      enable_fuzz: true,
      // Within-day practice is handled by the learning ladder; FSRS plans days.
      enable_short_term: false,
      maximum_interval: 3650,
    }),
  );
}

/** The grade comes from measured accuracy, never from the learner's opinion. */
export function ratingFromAccuracy(accuracy: number): Grade {
  if (accuracy < 0.6) return Rating.Again;
  if (accuracy < 0.85) return Rating.Hard;
  if (accuracy < 0.98) return Rating.Good;
  return Rating.Easy;
}

export const RATING_LABEL: Record<number, string> = {
  [Rating.Again]: "Olvidado",
  [Rating.Hard]: "Difícil",
  [Rating.Good]: "Bien",
  [Rating.Easy]: "Fácil",
};

const DAY = 86_400_000;
const dayKey = (iso: string) => iso.slice(0, 10);

export interface AttemptOutcome {
  verse: LearningVerse;
  stageBefore: Stage;
  stageAfter: Stage;
  passedStep: boolean;
  rating?: Grade;
  justMastered: boolean;
  /** Human-readable explanation of what happens next. */
  message: string;
}

/**
 * Applies one exercise result to a verse: advances the learning ladder,
 * updates the FSRS schedule for no-help recall and decides mastery.
 * Pure: returns a new verse object.
 */
export function applyAttempt(
  input: LearningVerse,
  mode: Mode,
  accuracy: number,
  now: Date,
  opts: { retention?: number; missedIndexes?: number[]; missedWords?: string[]; clozeLevel?: number } = {},
): AttemptOutcome {
  const v: LearningVerse = structuredClone(input);
  const stageBefore = v.stage;
  const isoNow = now.toISOString();
  const isRecall = RECALL_MODES.includes(mode);
  let passedStep = false;
  let rating: Grade | undefined;
  let justMastered = false;
  let message = "";

  for (const i of opts.missedIndexes ?? []) v.errorPositions[i] = (v.errorPositions[i] ?? 0) + 1;
  for (const w of opts.missedWords ?? []) v.errorWords[w] = (v.errorWords[w] ?? 0) + 1;
  v.reviews += 1;
  v.lastAccuracy = accuracy;
  v.updatedAt = isoNow;
  if (opts.clozeLevel !== undefined) v.clozeLevel = opts.clozeLevel;

  if (v.stage === "nuevo") v.stage = "aprendiendo";

  if (v.stage === "aprendiendo") {
    const step = LADDER[v.ladderStep] ?? "escribir";
    // A recall mode done well during learning also counts for its step.
    const relevant = mode === step || (isRecall && step === "escribir");
    const extraOk = step !== "completar" || (opts.clozeLevel ?? v.clozeLevel) >= RULES.clozeLevelToPass;
    if (relevant && accuracy >= RULES.stepPass && extraOk) {
      passedStep = true;
      v.ladderStep += 1;
      if (v.ladderStep >= LADDER.length) {
        // Graduates: from now on, only no-help recall on a spaced schedule.
        v.stage = "consolidando";
        const f = scheduler(opts.retention);
        const rec = f.next(createEmptyCard(now), now, ratingFromAccuracy(accuracy));
        v.card = rec.card;
        v.due = rec.card.due.toISOString();
        rating = ratingFromAccuracy(accuracy);
        message = `¡Lo escribiste de memoria! Pasa a consolidación. Próximo repaso: ${formatDue(rec.card.due, now)}.`;
      } else {
        message = `Paso superado. Siguiente: ${MODE_LABEL[LADDER[v.ladderStep]]}.`;
      }
    } else if (!relevant) {
      message = `Práctica registrada. Tu paso actual de aprendizaje es: ${MODE_LABEL[step]}.`;
    } else {
      message =
        step === "completar" && accuracy >= RULES.stepPass
          ? "Bien. Ahora con más palabras ocultas."
          : `Necesitas ${Math.round(RULES.stepPass * 100)} % para avanzar. Inténtalo otra vez.`;
    }
    // The graduation recall happens right after studying: it is short-term memory,
    // so it does not count as evidence of mastery.
    if (isRecall) {
      v.recallCount += 1;
      v.recallAccuracySum += accuracy;
    }
  } else if (isRecall) {
    // Consolidating or mastered: no-help recall drives the schedule.
    const f = scheduler(opts.retention);
    const card: Card = v.card ?? createEmptyCard(now);
    rating = ratingFromAccuracy(accuracy);
    const rec = f.next(card, now, rating);
    v.card = rec.card;
    v.due = rec.card.due.toISOString();
    v.recallCount += 1;
    v.recallAccuracySum += accuracy;
    recordEvidence(v, mode, accuracy, isoNow);

    if (v.stage === "dominado" && accuracy < RULES.lapseAccuracy) {
      v.stage = "consolidando";
      v.masteredAt = null;
      v.evidence = [];
      message = `Se te olvidaron partes. Vuelve a consolidación y lo verás pronto: ${formatDue(rec.card.due, now)}.`;
    } else if (v.stage === "consolidando" && isMastered(v.evidence)) {
      v.stage = "dominado";
      v.masteredAt = isoNow;
      justMastered = true;
      message = "¡Dominado! Lo recordaste sin ayudas en evaluaciones separadas durante semanas.";
    } else {
      message = `Próximo repaso: ${formatDue(rec.card.due, now)}.`;
    }
  } else {
    // Practice with support on a consolidated verse: useful, but it neither
    // moves the schedule nor counts as memorised.
    message = "Práctica registrada. Solo la recuperación sin ayudas cambia el calendario.";
  }

  return { verse: v, stageBefore, stageAfter: v.stage, passedStep, rating, justMastered, message };
}

/** Keeps the run of successive no-help recalls: a weak one breaks the run. */
function recordEvidence(v: LearningVerse, mode: Mode, accuracy: number, iso: string) {
  if (accuracy >= RULES.masteryAccuracy) {
    // One recall per day counts: same-day repeats show short-term memory only.
    if (!v.evidence.some((e) => dayKey(e.date) === dayKey(iso))) v.evidence.push({ date: iso, accuracy, mode });
  } else {
    v.evidence = [];
  }
}

export function isMastered(evidence: MasteryEvidence[]): boolean {
  if (evidence.length < RULES.masteryRecalls) return false;
  const first = new Date(evidence[0].date).getTime();
  const last = new Date(evidence[evidence.length - 1].date).getTime();
  return (last - first) / DAY >= RULES.masterySpanDays;
}

/** What the learner still needs for mastery, in words. */
export function masteryProgress(v: LearningVerse): string {
  if (v.stage === "dominado") return "Dominado";
  if (v.stage !== "consolidando") return "Primero hay que aprenderlo con los ejercicios guiados.";
  const n = v.evidence.length;
  const need = Math.max(0, RULES.masteryRecalls - n);
  if (need > 0) return `Faltan ${need} recuperaciones sin ayudas de ${Math.round(RULES.masteryAccuracy * 100)} % o más, en días distintos.`;
  const first = new Date(v.evidence[0].date).getTime();
  const days = Math.ceil(RULES.masterySpanDays - (Date.now() - first) / DAY);
  return `Ya tienes ${n} recuperaciones correctas seguidas. Falta demostrar que lo recuerdas dentro de ${Math.max(1, days)} días.`;
}

export function retrievability(v: LearningVerse, now: Date, retention = 0.9): number | null {
  if (!v.card) return null;
  return scheduler(retention).get_retrievability(v.card, now, false);
}

export const MODE_LABEL: Record<Mode, string> = {
  fragmentos: "Aprender por fragmentos",
  completar: "Completar palabras",
  elegir: "Elegir la palabra correcta",
  "ordenar-palabras": "Ordenar palabras",
  "ordenar-frases": "Ordenar frases",
  escribir: "Escribir de memoria",
  voz: "Recitar en voz alta",
  "sin-pistas": "Recuperación sin pistas",
};

export const STAGE_LABEL: Record<Stage, string> = {
  nuevo: "Nuevo",
  aprendiendo: "Aprendiendo",
  consolidando: "Consolidando",
  dominado: "Dominado",
};

export function formatDue(due: Date, now: Date): string {
  const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / DAY);
  if (days <= 0) return "hoy";
  if (days === 1) return "mañana";
  if (days < 30) return `en ${days} días`;
  return due.toLocaleDateString("es-DO", { day: "numeric", month: "long", year: "numeric" });
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
