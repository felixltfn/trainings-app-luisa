import type { Band, Session, YogaSession } from './db';
import { BAND_TARGET_TOP, WEEKLY_GOAL, addDays, isoDate, weekStart } from './logic';

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

// Progress on one scale: every finished band is worth BAND_TARGET_TOP points,
// the reps on the current band are added on top.
export function progressScore(session: Session, bands: Band[]): number {
  const sorted = [...bands].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((b) => b.id === session.bandSets[0]?.bandId);
  const reps = Math.min(...session.bandSets.map((s) => s.reps));
  return (index < 0 ? 0 : index) * BAND_TARGET_TOP + Math.min(reps, BAND_TARGET_TOP);
}

export interface Forecast {
  date: string | null; // estimated date of the first free chin-up
  reason: 'ok' | 'tooFewSessions' | 'noTrend';
  sessionsNeeded: number;
}

export const FORECAST_MIN_SESSIONS = 6;

// Rough linear estimate: how fast has the score grown so far, and when does it
// reach the score of "no band at all"?
export function forecastFreeChinUp(sessions: Session[], bands: Band[], today = new Date()): Forecast {
  const ordered = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
  if (ordered.length < FORECAST_MIN_SESSIONS) {
    return { date: null, reason: 'tooFewSessions', sessionsNeeded: FORECAST_MIN_SESSIONS - ordered.length };
  }

  const first = ordered[0].timestamp;
  const points = ordered.map((s) => ({ x: (s.timestamp - first) / 86400000, y: progressScore(s, bands) }));
  const n = points.length;
  const sumX = points.reduce((a, p) => a + p.x, 0);
  const sumY = points.reduce((a, p) => a + p.y, 0);
  const sumXY = points.reduce((a, p) => a + p.x * p.y, 0);
  const sumXX = points.reduce((a, p) => a + p.x * p.x, 0);
  const denominator = n * sumXX - sumX * sumX;
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;

  const target = bands.length * BAND_TARGET_TOP; // past the thinnest band = free
  const current = points[n - 1].y;
  if (slope <= 0.01 || current >= target) {
    return { date: null, reason: current >= target ? 'ok' : 'noTrend', sessionsNeeded: 0 };
  }

  const daysLeft = Math.ceil((target - current) / slope);
  const estimate = new Date(today.getTime() + daysLeft * 86400000);
  return { date: isoDate(estimate), reason: 'ok', sessionsNeeded: 0 };
}

export function yogaDates(list: YogaSession[]): string[] {
  return list.map((y) => y.date);
}
