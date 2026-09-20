// Test data for trying the app out: four weeks with three sessions each.
import { db, type FreeHeight } from './db';
import { isoDate } from './logic';

export async function generateTestData(): Promise<string> {
  const bands = (await db.bands.toArray()).sort((a, b) => a.order - b.order);
  if (bands.length === 0) return 'Es gibt noch keine Bänder.';

  const weeks = 4;
  const perWeek = 3;
  let created = 0;

  for (let w = weeks; w >= 1; w--) {
    for (let i = 0; i < perWeek; i++) {
      const day = new Date();
      day.setDate(day.getDate() - w * 7 + i * 2);
      const index = (weeks - w) * perWeek + i; // 0 … 11, the session number

      // Slow progress: reps grow, after six reps the next thinner band follows
      const bandIndex = Math.min(bands.length - 1, Math.floor(index / 4));
      const reps = 3 + (index % 4);
      const holdSeconds = 8 + index;
      const negative = index < 6 ? { reps: 3, seconds: 5 } : { reps: 4, seconds: 5 };
      // A free attempt every second week
      const free =
        index % 6 === 0
          ? { done: false, height: (index > 6 ? 'chin' : 'half') as FreeHeight }
          : null;

      await db.sessions.add({
        date: isoDate(day),
        timestamp: day.getTime(),
        hang: true,
        hangSeconds: 20 + index,
        bandSets: [
          { reps, bandId: bands[bandIndex].id },
          { reps: Math.max(1, reps - (index % 2)), bandId: bands[bandIndex].id },
        ],
        negativeReps: negative.reps,
        negativeSeconds: negative.seconds,
        holdSeconds,
        free,
      });
      await db.yoga.add({ date: isoDate(day), minutes: 40 + (index % 3) * 10 });
      created++;
    }
  }
  return `${created} Chin-Up- und ${created} Yoga-Einheiten über ${weeks} Wochen angelegt.`;
}

export async function clearAllData(): Promise<string> {
  await db.transaction('rw', db.sessions, db.yoga, async () => {
    await db.sessions.clear();
    await db.yoga.clear();
  });
  return 'Alle Einheiten gelöscht. Bänder und Einstellungen bleiben.';
}
