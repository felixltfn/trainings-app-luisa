import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';

import { Picker } from '../Picker';
import { clearAllData, generateTestData } from '../testdata';
import { exportBackup, importBackup } from '../backup';
import { BAND_COLORS, BAND_COLOR_NAMES, DEFAULT_BODYWEIGHT, db, getMeta, setMeta } from '../db';

export function SettingsScreen() {
  const [message, setMessage] = useState('');
  const [newBand, setNewBand] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const data = useLiveQuery(async () => {
    const bands = (await db.bands.toArray()).sort((a, b) => a.order - b.order);
    const sessions = await db.sessions.count();
    const yoga = await db.yoga.count();
    const lastExport = await getMeta<number>('lastExport');
    const bodyweight = (await getMeta<number>('bodyweight')) ?? DEFAULT_BODYWEIGHT;
    return { bands, sessions, yoga, lastExport, bodyweight };
  }, []);

  if (!data) return <div className="screen" />;
  const { bands, sessions, yoga, lastExport, bodyweight } = data;

  const run = async (fn: () => Promise<string>) => {
    try {
      setMessage(await fn());
    } catch (e) {
      setMessage(`Fehler: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const addBand = async () => {
    const name = newBand.trim();
    if (!name) return;
    setNewBand('');
    const used = new Set(bands.map((b) => b.color));
    const color = BAND_COLORS.find((c) => !used.has(c)) ?? BAND_COLORS[bands.length % BAND_COLORS.length];
    await db.bands.add({ name, order: bands.length, color, assistKg: 5 });
  };

  const renumber = async (list: { id: number }[]) => {
    await db.transaction('rw', db.bands, async () => {
      for (const [i, b] of list.entries()) await db.bands.update(b.id, { order: i });
    });
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...bands];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    await renumber(next);
  };

  const removeBand = async (id: number, name: string) => {
    const used = (await db.sessions.toArray()).some((s) => s.bandSets.some((x) => x.bandId === id));
    if (used) {
      setMessage(`Mit dem Band „${name}“ hast du schon trainiert – es bleibt für die Auswertung erhalten.`);
      return;
    }
    await db.bands.delete(id);
    await renumber(bands.filter((b) => b.id !== id));
  };

  return (
    <div className="screen">
      <p className="label">Einstellungen</p>
      <h1 className="title">Bänder &amp; Daten</h1>

      <div className="section">
        <p className="label">Bänder</p>
        <p className="small muted">
          Von oben nach unten: das oberste hilft am meisten, das unterste am wenigsten. Die Reihenfolge bestimmt,
          welches Band als Nächstes dran ist. Die Zahl daneben ist, wie viele Kilo dir das Band ungefähr abnimmt –
          damit rechnet die Prognose.
        </p>
        <div className="list section-sm">
          {bands.map((b, i) => (
            <div key={b.id} className="list-item">
              <span className="band-color">
                <Picker
                  title={`Farbe für „${b.name}“`}
                  value={b.color}
                  options={BAND_COLORS.map((c) => ({ value: c, label: BAND_COLOR_NAMES[c], color: c }))}
                  onChange={(v) => db.bands.update(b.id, { color: String(v) })}
                />
              </span>
              <input
                className="input grow"
                defaultValue={b.name}
                onBlur={(e) => e.target.value.trim() && db.bands.update(b.id, { name: e.target.value.trim() })}
              />
              <input
                className="input kg-input num"
                inputMode="decimal"
                aria-label={`Hilfe in Kilogramm für ${b.name}`}
                defaultValue={b.assistKg}
                onBlur={(e) => {
                  const kg = Number(e.target.value.replace(',', '.'));
                  if (Number.isFinite(kg) && kg >= 0) db.bands.update(b.id, { assistKg: kg });
                }}
              />
              <button className="icon-btn" aria-label="Nach oben" disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button
                className="icon-btn"
                aria-label="Nach unten"
                disabled={i === bands.length - 1}
                onClick={() => move(i, 1)}
              >
                ↓
              </button>
              <button className="icon-btn" aria-label="Band löschen" onClick={() => removeBand(b.id, b.name)}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="row section-sm">
          <input
            className="input grow"
            placeholder="z. B. extra dünn"
            value={newBand}
            onChange={(e) => setNewBand(e.target.value)}
          />
          <button className="btn" disabled={!newBand.trim()} onClick={addBand}>
            + Band
          </button>
        </div>
      </div>

      <div className="section">
        <p className="label">Körpergewicht</p>
        <p className="small muted">
          Ziel der Prognose: so viel Kraft, dass du dein eigenes Gewicht hochziehst. Ändere den Wert, wenn er sich
          verschiebt.
        </p>
        <label className="field">
          <span>Kilogramm</span>
          <input
            className="num-input"
            inputMode="decimal"
            defaultValue={bodyweight}
            onBlur={(e) => {
              const kg = Number(e.target.value.replace(',', '.'));
              if (Number.isFinite(kg) && kg > 0) setMeta('bodyweight', kg);
            }}
          />
        </label>
      </div>

      <div className="section">
        <p className="label">Daten</p>
        <p className="small muted">
          Alles liegt nur auf diesem Gerät: {sessions} Chin-Up-Einheiten, {yoga} Yoga-Einheiten. Letztes Backup:{' '}
          {lastExport ? new Date(lastExport).toLocaleDateString('de-DE') : 'noch nie'}.
        </p>
        <div className="stack section-sm">
          <button className="btn block" onClick={() => run(exportBackup)}>
            Backup exportieren (JSON)
          </button>
          <button className="btn secondary block" onClick={() => fileInput.current?.click()}>
            Backup importieren
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              if (!confirm('Import ersetzt ALLE Daten auf diesem Gerät. Fortfahren?')) return;
              run(() => importBackup(file));
            }}
          />
        </div>
      </div>

      <div className="section">
        <p className="label">Zum Ausprobieren</p>
        <p className="small muted">
          Legt vier Wochen mit je drei Chin-Up- und Yoga-Einheiten an, damit du Kalender, Diagramme und Prognose mit
          Inhalt siehst.
        </p>
        <div className="stack section-sm">
          <button className="btn secondary block" onClick={() => run(generateTestData)}>
            Testdaten anlegen (4 Wochen)
          </button>
          <button
            className="btn danger block"
            onClick={() => confirm('Alle eingetragenen Einheiten löschen?') && run(clearAllData)}
          >
            Alle Einheiten löschen
          </button>
        </div>
      </div>

      {message && <p className="banner section">{message}</p>}
    </div>
  );
}
