// The yoga timer stores a timestamp, not a countdown: the phone is put away during
// the session and iOS pauses JavaScript, so the elapsed time is always recomputed.

const KEY = 'yogaStart';

export function loadStart(): number | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

export function saveStart(startedAt: number | null): void {
  try {
    if (startedAt) localStorage.setItem(KEY, String(startedAt));
    else localStorage.removeItem(KEY);
  } catch {
    // Private mode: the timer still works for this session.
  }
}

export function minutesSince(startedAt: number, now = Date.now()): number {
  return Math.max(1, Math.round((now - startedAt) / 60000));
}
