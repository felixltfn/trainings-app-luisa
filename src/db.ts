import Dexie, { type EntityTable } from 'dexie';

// A band she pulls with. Order 0 is the thickest (most help), the last one the thinnest.
// The colour is how she recognises it on the bar.
export interface Band {
  id: number;
  name: string;
  order: number;
  color: string; // one of BAND_COLORS
  assistKg: number; // roughly how much the band takes off her bodyweight
}

// Her bands, from thick to thin
// Bright, like the bands themselves
export const BAND_COLORS = ['#22d24b', '#f52d2d', '#ff8a1f', '#ffd60a', '#2f9bff', '#a855f7'] as const;
export const BAND_COLOR_NAMES: Record<string, string> = {
  '#22d24b': 'grün',
  '#f52d2d': 'rot',
  '#ff8a1f': 'orange',
  '#ffd60a': 'gelb',
  '#2f9bff': 'blau',
  '#a855f7': 'lila',
};

// The muted first palette, replaced by the bright one above
const OLD_COLORS: Record<string, string> = {
  '#2e7d46': '#22d24b',
  '#c0392b': '#f52d2d',
  '#e07b1f': '#ff8a1f',
  '#e3b505': '#ffd60a',
  '#3b6fb0': '#2f9bff',
  '#6d4c9f': '#a855f7',
};

export type FreeHeight = 'chin' | 'half' | 'less';

// One chin-up session: always the same four positions, so it is one record.
export interface Session {
  id: number;
  date: string; // YYYY-MM-DD
  timestamp: number; // epoch ms
  hang: boolean; // optional warm-up
  hangSeconds: number | null; // how long she hung, if she wants to note it
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

export const DEFAULT_BODYWEIGHT = 65;

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

// Version 2 added the band colour and the hang duration
db.version(2)
  .stores({
    bands: '++id, order',
    sessions: '++id, date, timestamp',
    yoga: '++id, date',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    const bands = await tx.table('bands').toArray();
    for (const [i, band] of bands.entries()) {
      if (!band.color) await tx.table('bands').update(band.id, { color: BAND_COLORS[i % BAND_COLORS.length] });
    }
    const sessions = await tx.table('sessions').toArray();
    for (const s of sessions) {
      if (s.hangSeconds === undefined) await tx.table('sessions').update(s.id, { hangSeconds: null });
    }
  });

// Version 3 swapped the muted band colours for bright ones
db.version(3)
  .stores({
    bands: '++id, order',
    sessions: '++id, date, timestamp',
    yoga: '++id, date',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    for (const band of await tx.table('bands').toArray()) {
      const bright = OLD_COLORS[band.color];
      if (bright) await tx.table('bands').update(band.id, { color: bright });
    }
  });

// Version 4 added the band assistance in kg, needed for the forecast
db.version(4)
  .stores({
    bands: '++id, order',
    sessions: '++id, date, timestamp',
    yoga: '++id, date',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    const defaults = [20, 13, 7];
    const bands = await tx.table('bands').toArray();
    for (const band of bands) {
      if (band.assistKg === undefined) {
        await tx.table('bands').update(band.id, { assistKg: defaults[band.order] ?? 5 });
      }
    }
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
    { name: 'dick', order: 0, color: BAND_COLORS[0], assistKg: 20 },
    { name: 'mittel', order: 1, color: BAND_COLORS[1], assistKg: 13 },
    { name: 'dünn', order: 2, color: BAND_COLORS[2], assistKg: 7 },
  ]);
}
