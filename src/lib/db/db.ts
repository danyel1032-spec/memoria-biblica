import Dexie, { type EntityTable } from "dexie";
import type { Attempt, Collection, LearningVerse, Settings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

/**
 * Local-first storage. Everything lives on the device (IndexedDB) so learning
 * and review work offline. A later phase syncs this with Supabase.
 */
class MemoriaDB extends Dexie {
  verses!: EntityTable<LearningVerse, "id">;
  attempts!: EntityTable<Attempt, "id">;
  collections!: EntityTable<Collection, "id">;
  settings!: EntityTable<{ key: string; value: Settings }, "key">;

  constructor() {
    super("memoria-biblica");
    this.version(1).stores({
      verses: "id, stage, due, addedAt, favorite, *collectionIds, [ref.book+ref.chapter+ref.verseStart]",
      attempts: "id, verseId, date, mode",
      collections: "id, name",
      settings: "key",
    });
  }
}

export const db = new MemoriaDB();

export async function getSettings(): Promise<Settings> {
  const row = await db.settings.get("app");
  return { ...DEFAULT_SETTINGS, ...(row?.value ?? {}) };
}

export async function saveSettings(s: Settings) {
  await db.settings.put({ key: "app", value: s });
}

/** Asks the browser not to evict our data when storage is low. */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

// ---------- Backup ----------

export interface Backup {
  app: "memoria-biblica";
  version: 1;
  exportedAt: string;
  verses: LearningVerse[];
  attempts: Attempt[];
  collections: Collection[];
  settings: Settings;
}

export async function exportBackup(): Promise<Backup> {
  const [verses, attempts, collections, settings] = await Promise.all([
    db.verses.toArray(),
    db.attempts.toArray(),
    db.collections.toArray(),
    getSettings(),
  ]);
  return { app: "memoria-biblica", version: 1, exportedAt: new Date().toISOString(), verses, attempts, collections, settings };
}

export function validateBackup(data: unknown): data is Backup {
  if (!data || typeof data !== "object") return false;
  const d = data as Partial<Backup>;
  return d.app === "memoria-biblica" && Array.isArray(d.verses) && Array.isArray(d.attempts) && Array.isArray(d.collections);
}

/** Restores a backup, merging by id (newer `updatedAt` wins for verses). */
export async function importBackup(b: Backup): Promise<{ verses: number; attempts: number }> {
  let verses = 0;
  await db.transaction("rw", db.verses, db.attempts, db.collections, db.settings, async () => {
    for (const v of b.verses) {
      if (v.card) {
        // Dates come back as strings from JSON.
        v.card = { ...v.card, due: new Date(v.card.due), last_review: v.card.last_review ? new Date(v.card.last_review) : undefined };
      }
      const existing = await db.verses.get(v.id);
      if (!existing || existing.updatedAt < v.updatedAt) {
        await db.verses.put(v);
        verses++;
      }
    }
    await db.attempts.bulkPut(b.attempts);
    await db.collections.bulkPut(b.collections);
    if (b.settings) await saveSettings({ ...(await getSettings()), ...b.settings });
  });
  return { verses, attempts: b.attempts.length };
}
