import type { Band, Session, YogaSession } from './db';
import { BAND_TARGET_TOP, WEEKLY_GOAL, addDays, daysBetween, isoDate, weekStart } from './logic';

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
  reason: 'ok' | 'tooFewSessions' | 'tooShort' | 'noTrend' | 'reached';
  sessionsNeeded: number;
  score: number; // where she stands today
  target: number; // score that means "no band at all"
  perWeek: number; // progress per week so far
  weeks: number; // weeks the estimate is based on
}

export const FORECAST_MIN_SESSIONS = 6;
export const FORECAST_MIN_DAYS = 21; // less than three weeks says nothing about the pace

// Rough estimate on one scale: every band is worth 6 points, the reps on the current
// band are added. How many points per week has she gained, and how long until the
// score of "no band" is reached?
export function forecastFreeChinUp(sessions: Session[], bands: Band[], today = new Date()): Forecast {
  const ordered = [...sessions].sort((a, b) => a.timestamp - b.timestamp);
  const target = bands.length * BAND_TARGET_TOP;
  const empty = { date: null, sessionsNeeded: 0, score: 0, target, perWeek: 0, weeks: 0 };

  if (ordered.length < FORECAST_MIN_SESSIONS) {
    return { ...empty, reason: 'tooFewSessions', sessionsNeeded: FORECAST_MIN_SESSIONS - ordered.length };
  }

  // Averaged over three sessions at each end, so a single weak day doesn't flip the estimate
  const early = ordered.slice(0, 3);
  const late = ordered.slice(-3);
  const avg = (list: Session[]) => list.reduce((sum, s) => sum + progressScore(s, bands), 0) / list.length;
  const middleDate = (list: Session[]) => list[Math.floor(list.length / 2)].date;
  const days = daysBetween(middleDate(early), middleDate(late));
  const score = Math.round(avg(late) * 10) / 10;
  const startScore = avg(early);

  if (progressScore(ordered[ordered.length - 1], bands) >= target) {
    return { ...empty, reason: 'reached', score };
  }
  // All sessions within a few days say nothing about the pace
  if (days < FORECAST_MIN_DAYS) return { ...empty, reason: 'tooShort', score };

  const weeks = days / 7;
  const perWeek = (score - startScore) / weeks;
  if (perWeek <= 0) return { ...empty, reason: 'noTrend', score, weeks: Math.round(weeks) };

  const weeksLeft = Math.ceil((target - score) / perWeek);
  const estimate = addDays(isoDate(today), weeksLeft * 7);
  return {
    date: estimate,
    reason: 'ok',
    sessionsNeeded: 0,
    score,
    target,
    perWeek: Math.round(perWeek * 10) / 10,
    weeks: Math.round(weeks),
  };
}

export function yogaDates(list: YogaSession[]): string[] {
  return list.map((y) => y.date);
}
