import type { Band, Session, YogaSession } from './db';
import { WEEKLY_GOAL, addDays, daysBetween, isoDate, isoWeek, weekStart } from './logic';

// How many sessions fall into the week that starts on `monday`
export function countInWeek(dates: string[], monday: string): number {
  const sunday = addDays(monday, 6);
  return dates.filter((d) => d >= monday && d <= sunday).length;
}

// Weeks in a row in which the goal was met. The running week never breaks the
// streak – it only counts once the goal is reached.
export function weekStreak(dates: string[], goal = WEEKLY_GOAL, today = new Date()): number {
  const thisWeek = weekStart(today);
  let streak = countInWeek(dates, thisWeek) >= goal ? 1 : 0;
  for (let w = addDays(thisWeek, -7); countInWeek(dates, w) >= goal; w = addDays(w, -7)) streak++;
  return streak;
}

// ---------- Forecast for the first free chin-up ----------

export const FORECAST_MIN_SESSIONS = 6;
export const FORECAST_WINDOW = 12; // only the most recent sessions count
const MAX_REPS_FOR_EPLEY = 10; // above that the formula gets unreliable

// Step 1 + 2: effective load per set, then Epley. The best set of the session counts.
export function sessionE1rm(session: Session, bands: Band[], bodyweight: number): number | null {
  const values = session.bandSets
    .filter((set) => set.reps >= 1 && set.reps <= MAX_REPS_FOR_EPLEY)
    .map((set) => {
      const assist = bands.find((b) => b.id === set.bandId)?.assistKg ?? 0;
      const load = bodyweight - assist;
      return load * (1 + set.reps / 30);
    });
  return values.length > 0 ? Math.max(...values) : null;
}

export interface Forecast {
  reason: 'ok' | 'now' | 'beyondYear' | 'tooFewSessions' | 'noTrend' | 'done';
  week: number | null; // calendar week of the estimate
  year: number | null;
  sessionsNeeded: number;
  slopePerWeek: number; // kg per week
  r2: number; // how well the line fits
  confidence: string; // that, in words
  current: number; // today's estimated max strength
  bodyweight: number;
}

function confidenceText(r2: number): string {
  if (r2 >= 0.7) return 'Trend ist deutlich';
  if (r2 >= 0.4) return 'Trend ist erkennbar, schwankt aber';
  return 'noch zu schwankend für eine Aussage';
}

// Steps 3 + 4: straight line through the e1rm values, then the day it reaches her bodyweight.
export function forecastFreeChinUp(
  sessions: Session[],
  bands: Band[],
  bodyweight: number,
  today = new Date(),
): Forecast {
  const empty = {
    week: null,
    year: null,
    sessionsNeeded: 0,
    slopePerWeek: 0,
    r2: 0,
    confidence: confidenceText(0),
    current: 0,
    bodyweight,
  };

  // Already done it once – nothing left to estimate
  if (sessions.some((s) => s.free?.done)) return { ...empty, reason: 'done' };

  const ordered = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
  const points = ordered
    .map((s) => ({ date: s.date, e1rm: sessionE1rm(s, bands, bodyweight) }))
    .filter((p): p is { date: string; e1rm: number } => p.e1rm !== null)
    .slice(-FORECAST_WINDOW);

  if (points.length < FORECAST_MIN_SESSIONS) {
    return { ...empty, reason: 'tooFewSessions', sessionsNeeded: FORECAST_MIN_SESSIONS - points.length };
  }

  // Linear regression of e1rm against the date, x in days
  const firstDate = points[0].date;
  const xs = points.map((p) => daysBetween(firstDate, p.date));
  const ys = points.map((p) => p.e1rm);
  const n = points.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  const sxx = xs.reduce((a, x) => a + (x - meanX) ** 2, 0);
  const sxy = xs.reduce((a, x, i) => a + (x - meanX) * (ys[i] - meanY), 0);
  const slope = sxx === 0 ? 0 : sxy / sxx; // kg per day
  const intercept = meanY - slope * meanX;

  // R²: how much of the scatter the line explains
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0);
  const ssRes = ys.reduce((a, y, i) => a + (y - (intercept + slope * xs[i])) ** 2, 0);
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  // Where the line stands today, not at the last session
  const current = intercept + slope * daysBetween(firstDate, isoDate(today));
  const base = { ...empty, slopePerWeek: slope * 7, r2, confidence: confidenceText(r2), current };

  if (slope <= 0) return { ...base, reason: 'noTrend' };
  // Already strong enough on paper – no point naming a future week
  if (current >= bodyweight) return { ...base, reason: 'now' };

  // The day the line reaches her bodyweight
  const targetDate = addDays(firstDate, Math.ceil((bodyweight - intercept) / slope));
  if (daysBetween(isoDate(today), targetDate) > 365) return { ...base, reason: 'beyondYear' };

  const { week, year } = isoWeek(targetDate);
  return { ...base, reason: 'ok', week, year };
}

export function yogaDates(list: YogaSession[]): string[] {
  return list.map((y) => y.date);
}
