import Dexie, { type EntityTable } from 'dexie';

// A band she pulls with. Order 0 is the thickest (most help), the last one the thinnest.
export interface Band {
  id: number;
  name: string;
  order: number;
}

export type FreeHeight = 'chin' | 'half' | 'less';

// One chin-up session: always the same four positions, so it is one record.
export interface Session {
  id: number;
  date: string; // YYYY-MM-DD
  timestamp: number; // epoch ms
  hang: boolean; // optional warm-up, just ticked off
  bandSets: { reps: number; bandId: number }[]; // 2 sets
  negativeReps: number;
  negativeSeconds: number; // lowering time per rep
  holdSeconds: number;
  // The free attempt without a band, only when it was due
  free: { done: boolean; height: FreeHeight | null } | null;
}

export interface YogaSession {
  id: number;
  date: string; // YYYY-MM-DD
  minutes: number;
}

export interface Meta {
  key: string;
  value: unknown;
}

export const db = new Dexie('chinups') as Dexie & {
  bands: EntityTable<Band, 'id'>;
  sessions: EntityTable<Session, 'id'>;
  yoga: EntityTable<YogaSession, 'id'>;
  meta: EntityTable<Meta, 'key'>;
};

db.version(1).stores({
  bands: '++id, order',
  sessions: '++id, date, timestamp',
  yoga: '++id, date',
  meta: 'key',
});

export const TABLES = ['bands', 'sessions', 'yoga', 'meta'] as const;

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

// The three bands she owns right now. Editable later in the settings.
export async function seedIfEmpty(): Promise<void> {
  if ((await db.bands.count()) > 0) return;
  await db.bands.bulkAdd([
    { name: 'dick', order: 0 },
    { name: 'mittel', order: 1 },
    { name: 'dünn', order: 2 },
  ]);
}
