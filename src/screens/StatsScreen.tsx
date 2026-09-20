import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { DEFAULT_BODYWEIGHT, db, getMeta } from '../db';
import { WEEKLY_GOAL, fmtDate, fmtNum, freeHeightLabel, isoDate, parseIsoDate, weekStart } from '../logic';
import { countInWeek, forecastFreeChinUp, weekStreak } from '../stats';

const axis = { fontSize: 12, fill: 'var(--text-2)' };
const shortDate = (iso: string) => parseIsoDate(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
const tooltipDate = (label: unknown) => (typeof label === 'string' ? shortDate(label) : '');

// Time window for the charts. A single week would leave one or two points.
const RANGES = [
  { id: '1m', label: '1 Monat', months: 1 },
  { id: '3m', label: '3 Monate', months: 3 },
  { id: '1y', label: '1 Jahr', months: 12 },
  { id: 'max', label: 'Max', months: 0 },
] as const;

export function StatsScreen() {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('3m');

  const data = useLiveQuery(async () => {
    const bands = (await db.bands.toArray()).sort((a, b) => a.order - b.order);
    const sessions = (await db.sessions.toArray()).sort((a, b) => a.timestamp - b.timestamp);
    const yoga = await db.yoga.toArray();
    const bodyweight = (await getMeta<number>('bodyweight')) ?? DEFAULT_BODYWEIGHT;
    return { bands, sessions, yoga, bodyweight };
  }, []);

  if (!data) return <div className="screen" />;
  const { bands, sessions, yoga, bodyweight } = data;

  const months = RANGES.find((r) => r.id === range)?.months ?? 0;
  const cutoff = months > 0 ? isoDate(new Date(new Date().setMonth(new Date().getMonth() - months))) : '';
  const shown = sessions.filter((s) => s.date >= cutoff);

  const monday = weekStart(new Date());
  const chinWeek = countInWeek(sessions.map((s) => s.date), monday);
  const yogaWeek = countInWeek(yoga.map((y) => y.date), monday);
  const chinStreak = weekStreak(sessions.map((s) => s.date));
  const yogaStreak = weekStreak(yoga.map((y) => y.date));

  // One line per band, so a band change shows up as its own line
  const repSeries = shown.map((s) => {
    const point: Record<string, number | string> = { date: s.date };
    const band = bands.find((b) => b.id === s.bandSets[0]?.bandId);
    if (band) point[band.name] = Math.min(...s.bandSets.map((x) => x.reps));
    return point;
  });
  const holdSeries = shown.map((s) => ({ date: s.date, sekunden: s.holdSeconds }));
  const attempts = sessions.filter((s) => s.free !== null).reverse();
  const forecast = forecastFreeChinUp(sessions, bands, bodyweight);

  return (
    <div className="screen">
      <p className="label">Statistik</p>
      <h1 className="title">Fortschritt</h1>

      <div className="section">
        <p className="label">Diese Woche</p>
        <div className="stats-row two">
          <div className="stat">
            <p className="label">Chin-Ups</p>
            <div className="big-num">
              {chinWeek}
              <span className="muted"> / {WEEKLY_GOAL}</span>
            </div>
            <p className="small muted">{chinStreak} Wochen in Folge</p>
          </div>
          <div className="stat">
            <p className="label">Yoga</p>
            <div className="big-num">
              {yogaWeek}
              <span className="muted"> / {WEEKLY_GOAL}</span>
            </div>
            <p className="small muted">{yogaStreak} Wochen in Folge</p>
          </div>
        </div>
      </div>

      <div className="section">
        <p className="label">Zeitraum der Diagramme</p>
        <div className="segmented">
          {RANGES.map((r) => (
            <button key={r.id} className={range === r.id ? 'on' : ''} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="muted section">In diesem Zeitraum liegt keine Einheit. Wähle einen längeren Zeitraum.</p>
      ) : (
        <>
          <div className="section">
            <p className="label">Wiederholungen je Band</p>
            <div className="chart">
              <ResponsiveContainer>
                <LineChart data={repSeries} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axis} tickLine={false} axisLine={false} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                  <Tooltip labelFormatter={tooltipDate} />
                  <Legend wrapperStyle={{ fontSize: 13 }} />
                  {bands.map((b) => (
                    <Line
                      key={b.id}
                      type="monotone"
                      dataKey={b.name}
                      name={`Band ${b.name}`}
                      stroke={b.color}
                      strokeWidth={2}
                      connectNulls
                      dot={{ r: 3 }}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="small muted">Je dünner das Band, desto mehr ziehst du selbst.</p>
          </div>

          <div className="section">
            <p className="label">Oben halten (Sekunden)</p>
            <div className="chart">
              <ResponsiveContainer>
                <LineChart data={holdSeries} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={axis} tickLine={false} axisLine={false} />
                  <YAxis tick={axis} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
                  <Tooltip labelFormatter={tooltipDate} />
                  <Line
                    type="monotone"
                    dataKey="sekunden"
                    name="Sekunden"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <div className="section">
        <p className="label">Freie Versuche</p>
        {attempts.length === 0 ? (
          <p className="muted small">Noch kein freier Versuch eingetragen.</p>
        ) : (
          <div className="timeline">
            {attempts.map((s) => (
              <div key={s.id} className="timeline-item">
                <span className={`dot${s.free?.done ? ' yes' : ''}`} />
                <span className="grow">{fmtDate(s.date)}</span>
                <span className={s.free?.done ? 'accent' : 'muted'}>
                  {s.free?.done ? 'geschafft' : freeHeightLabel(s.free?.height ?? null)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <p className="label">Erster freier Chin-Up</p>

        {forecast.reason === 'done' && (
          <p className="accent">Du hast ihn schon geschafft – ab jetzt zählt nur noch, wie oft.</p>
        )}

        {forecast.reason === 'tooFewSessions' && (
          <p className="muted small">
            Noch {forecast.sessionsNeeded} {forecast.sessionsNeeded === 1 ? 'Einheit' : 'Einheiten'}, dann rechnet
            die App eine Schätzung aus.
          </p>
        )}

        {forecast.reason === 'noTrend' && (
          <p className="muted small">
            Der Trend zeichnet sich noch nicht ab. Trag weiter ein, dann erscheint hier eine Schätzung.
          </p>
        )}

        {forecast.reason === 'now' && (
          <>
            <div className="big-num">jetzt</div>
            <p className="small muted">
              Rechnerisch bist du stark genug: deine geschätzte Maximalkraft liegt bei{' '}
              <b>{fmtNum(forecast.current)} kg</b>, dein Körpergewicht bei <b>{fmtNum(forecast.bodyweight)} kg</b>.
              Probier den freien Versuch beim nächsten Training. Verlässlichkeit: {forecast.confidence}.
            </p>
          </>
        )}

        {forecast.reason === 'beyondYear' && (
          <>
            <div className="big-num">noch länger als ein Jahr</div>
            <p className="small muted">Bei diesem Tempo dauert es noch über zwölf Monate. {forecast.confidence}.</p>
          </>
        )}

        {forecast.reason === 'ok' && (
          <>
            <div className="big-num">KW {forecast.week}</div>
            <p className="small muted">
              Bei diesem Tempo wärst du etwa in KW {forecast.week} ({forecast.year}) so weit. Das ist eine grobe
              Schätzung.
            </p>
            <p className="small muted">
              Gerechnet aus deiner geschätzten Maximalkraft: aktuell rund <b>{fmtNum(forecast.current)} kg</b>, Ziel
              ist dein Körpergewicht von <b>{fmtNum(forecast.bodyweight)} kg</b>. Zuletzt kamen{' '}
              <b>{fmtNum(forecast.slopePerWeek)} kg</b> pro Woche dazu. Verlässlichkeit: {forecast.confidence}.
            </p>
          </>
        )}

        {forecast.reason !== 'done' && forecast.reason !== 'tooFewSessions' && (
          <p className="small muted">
            Die Bänder helfen unten mehr als oben, die hinterlegten Kilogramm sind deshalb Näherungswerte. Die
            Schätzung ist zur Motivation da, nicht zur Planung.
          </p>
        )}
      </div>
    </div>
  );
}
