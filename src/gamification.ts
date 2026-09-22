import type { Band, Session } from './db';
import { sessionE1rm } from './stats';

// ---------- The island: every finished chin-up day adds one piece ----------

// 14 weeks with 3 chin-up days each – the whole picture by the big goal. The unicorn is the last piece.
// public/chamber-pieces.png holds, per pixel, the day that brings it (see scripts/split-chamber.py).
export const CHAMBER_PIECES = 42;
export const PIECE_STEP = 3; // piece n is stored as grey value n * 3, robust against rounding

// Meta keys: the day that was finished (after yoga or "Heute kein Yoga"), and the pieces she has already seen appear
export const META_DAY_CLOSED = 'dayClosed';
export const META_CHAMBER_SEEN = 'chamberSeen';

export interface ChamberState {
  count: number; // pieces on the island
  complete: boolean;
}

export function chamberState(pieces: number): ChamberState {
  const count = Math.min(Math.max(0, pieces), CHAMBER_PIECES);
  return { count, complete: count === CHAMBER_PIECES };
}

// Days with chin-ups. Today only counts once the day is finished; earlier days always count.
export function chamberPieces(chinDates: string[], dayClosed: string | null, today: string): number {
  const days = new Set(chinDates.filter((d) => d < today || (d === today && dayClosed === today)));
  return days.size;
}

// ---------- The strength flask: estimated strength against her bodyweight ----------

export const POTION_WINDOW = 3; // recent sessions averaged, so one bad day barely moves it

// Liquid range measured on public/potion-liquid.webp, in % of the image height
export const POTION_LIQUID_TOP = 26;
export const POTION_LIQUID_BOTTOM = 99.5;

// 0..1 – full means strong enough for a chin-up without a band
export function potionLevel(sessions: Session[], bands: Band[], bodyweight: number): number {
  if (sessions.some((s) => s.free?.done)) return 1;
  const recent = [...sessions]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((s) => sessionE1rm(s, bands, bodyweight))
    .filter((v): v is number => v !== null)
    .slice(-POTION_WINDOW);
  if (recent.length === 0 || bodyweight <= 0) return 0;
  const average = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Math.min(1, Math.max(0, average / bodyweight));
}

// Where the liquid surface sits, in % from the top of the image
export function potionSurface(level: number): number {
  return POTION_LIQUID_BOTTOM - level * (POTION_LIQUID_BOTTOM - POTION_LIQUID_TOP);
}
