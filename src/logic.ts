import type { Band, Session } from './db';

// ---------- Dates (always local time, never UTC) ----------

export function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Monday of the week containing d
export function weekStart(d: Date): string {
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return isoDate(monday);
}

export function addDays(iso: string, days: number): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIsoDate(toIso).getTime() - parseIsoDate(fromIso).getTime()) / 86400000);
}

// Always dd.mm.yy – short and unmistakable
export function fmtDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function fmtMinutes(min: number): string {
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------- The rules ----------

export const WEEKLY_GOAL = 3;
export const BAND_TARGET_TOP = 6; // reps per set that finish a band
export const BAND_TARGET_START = 3; // reps per set right after switching to a thinner band
export const HOLD_TOP = 20; // seconds that finish a hold stage
export const HOLD_START = 10;
export const BIG_GOAL_DATE = '2026-12-31';

export interface NegativeStep {
  reps: number;
  seconds: number;
}

// The ladder for the negative chin-ups, in order
export const NEGATIVE_STEPS: NegativeStep[] = [
  { reps: 3, seconds: 5 },
  { reps: 4, seconds: 5 },
  { reps: 3, seconds: 8 },
  { reps: 4, seconds: 8 },
];

export interface Plan {
  bandId: number | null;
  bandName: string;
  repTarget: number;
  thickerHint: boolean; // two weak sessions in a row -> suggest the thicker band
  negative: NegativeStep;
  holdTarget: number;
  holdDeeper: boolean; // hint to start from bent arms
  freeDue: boolean;
  freeEveryDays: number;
  nextFreeDate: string | null;
}

const sortBands = (bands: Band[]) => [...bands].sort((a, b) => a.order - b.order);
const bandOf = (bands: Band[], id: number | null) => bands.find((b) => b.id === id);
const minReps = (s: Session) => Math.min(...s.bandSets.map((x) => x.reps));
const sessionBandId = (s: Session) => s.bandSets[0]?.bandId ?? null;

// A thinner band = the next higher order value
function thinnerBand(bands: Band[], id: number | null): Band | undefined {
  const sorted = sortBands(bands);
  const i = sorted.findIndex((b) => b.id === id);
  return i >= 0 ? sorted[i + 1] : undefined;
}

function thickerBand(bands: Band[], id: number | null): Band | undefined {
  const sorted = sortBands(bands);
  const i = sorted.findIndex((b) => b.id === id);
  return i > 0 ? sorted[i - 1] : undefined;
}

export function isThinnest(bands: Band[], id: number | null): boolean {
  const sorted = sortBands(bands);
  return sorted.length > 0 && sorted[sorted.length - 1].id === id;
}

// Has she ever done both sets with 6 reps on the thinnest band?
export function masteredThinnest(sessions: Session[], bands: Band[]): boolean {
  return sessions.some((s) => isThinnest(bands, sessionBandId(s)) && minReps(s) >= BAND_TARGET_TOP);
}

// The next step of the negative ladder: the first one she has never completed
export function negativeStep(sessions: Session[]): NegativeStep {
  let index = 0;
  for (const [i, step] of NEGATIVE_STEPS.entries()) {
    const done = sessions.some((s) => s.negativeReps >= step.reps && s.negativeSeconds >= step.seconds);
    if (done) index = i + 1;
  }
  return NEGATIVE_STEPS[Math.min(index, NEGATIVE_STEPS.length - 1)];
}

// Hold: after every session above 20 s she starts deeper, and 10 s is the target again
export function holdState(sessions: Session[]): { target: number; deeper: boolean; level: number } {
  const ordered = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
  const level = ordered.filter((s) => s.holdSeconds > HOLD_TOP).length;
  const lastUp = ordered.map((s) => s.holdSeconds > HOLD_TOP).lastIndexOf(true);
  const since = ordered.slice(lastUp + 1);
  const reachedStart = since.some((s) => s.holdSeconds >= HOLD_START);
  return { target: reachedStart ? HOLD_TOP : HOLD_START, deeper: level > 0, level };
}

// Everything she should aim for next time, derived from all sessions so far
export function buildPlan(sessions: Session[], bands: Band[], today = isoDate(new Date())): Plan {
  const ordered = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
  const last = ordered[ordered.length - 1];
  const sorted = sortBands(bands);

  let bandId = last ? sessionBandId(last) : (sorted[0]?.id ?? null);
  let repTarget = BAND_TARGET_START;

  if (last) {
    if (minReps(last) >= BAND_TARGET_TOP) {
      const next = thinnerBand(bands, bandId);
      if (next) {
        bandId = next.id;
        repTarget = BAND_TARGET_START;
      } else {
        repTarget = BAND_TARGET_TOP; // already on the thinnest band
      }
    } else {
      repTarget = Math.min(BAND_TARGET_TOP, minReps(last) + 1);
    }
  }

  // Two sessions in a row with only 2 reps on the same band -> the thicker one helps more
  const lastTwo = ordered.slice(-2);
  const thickerHint =
    lastTwo.length === 2 &&
    lastTwo.every((s) => sessionBandId(s) === sessionBandId(lastTwo[0]) && minReps(s) <= 2) &&
    !!thickerBand(bands, sessionBandId(lastTwo[0]));

  const hold = holdState(ordered);
  const freeEveryDays = masteredThinnest(ordered, bands) ? 7 : 14;
  const lastFree = ordered.filter((s) => s.free !== null).pop();
  const nextFreeDate = lastFree ? addDays(lastFree.date, freeEveryDays) : null;
  const freeDue = !lastFree || daysBetween(lastFree.date, today) >= freeEveryDays;

  return {
    bandId,
    bandName: bandOf(bands, bandId)?.name ?? '–',
    repTarget,
    thickerHint,
    negative: negativeStep(ordered),
    holdTarget: hold.target,
    holdDeeper: hold.deeper,
    freeDue,
    freeEveryDays,
    nextFreeDate,
  };
}

export function freeHeightLabel(height: string | null): string {
  if (height === 'chin') return 'Kinn über der Stange';
  if (height === 'half') return 'halbe Höhe';
  if (height === 'less') return 'weniger als die halbe Höhe';
  return '–';
}
