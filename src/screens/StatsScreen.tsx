import { useLiveQuery } from 'dexie-react-hooks';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { db } from '../db';
import { WEEKLY_GOAL, fmtDate, freeHeightLabel, parseIsoDate, weekStart } from '../logic';
import { countInWeek, forecastFreeChinUp, weekStreak } from '../stats';

const axis = { fontSize: 12, fill: 'var(--text-2)' };
const shortDate = (iso: string) => parseIsoDate(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
const tooltipDate = (label: unknown) => (typeof label === 'string' ? shortDate(label) : '');

export function StatsScreen() {
  const data = useLiveQuery(async () => {
    const bands = (await db.bands.toArray()).sort((a, b) => a.order - b.order);
    const sessions = (await db.sessions.toArray()).sort((a, b) => a.timestamp - b.timestamp);
    const yoga = await db.yoga.toArray();
    return { bands, sessions, yoga };
  }, []);

  if (!data) return <div className="screen" />;
  const { bands, sessions, yoga } = data;

  const monday = weekStart(new Date());
  const chinWeek = countInWeek(sessions.map((s) => s.date), monday);
  const yogaWeek = countInWeek(yoga.map((y) => y.date), monday);
  const chinStreak = weekStreak(sessions.map((s) => s.date));
  const yogaStreak = weekStreak(yoga.map((y) => y.date));

  // One line per band: reps over time, so a band change is visible as a new line
  const repSeries = sessions.map((s) => {
    const point: Record<string, number | string> = { date: s.date };
    const band = bands.find((b) => b.id === s.bandSets[0]?.bandId);
    if (band) point[band.name] = Math.min(...s.bandSets.map((x) => x.reps));
    return point;
  });
  const holdSeries = sessions.map((s) => ({ date: s.date, sekunden: s.holdSeconds }));
  const attempts = sessions.filter((s) => s.free !== null).reverse();
  const forecast = forecastFreeChinUp(sessions, bands);

  return (
    <div className="screen">
      <p className="label">Statistik</p>
      <h1 className="title">Fortschritt</h1>

      <div className="section">
        <p className="label">Diese Woche</p>
        <div className="stats-row">
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

      {sessions.length > 0 && (
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
                  <Line type="monotone" dataKey="sekunden" name="Sekunden" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
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
        {forecast.reason === 'tooFewSessions' ? (
          <p className="muted small">
            Noch {forecast.sessionsNeeded} {forecast.sessionsNeeded === 1 ? 'Einheit' : 'Einheiten'}, dann zeigt die
            App hier eine Schätzung. Vorher wäre sie reine Kaffeesatzleserei.
          </p>
        ) : forecast.date ? (
          <>
            <div className="big-num">{fmtDate(forecast.date)}</div>
            <p className="small muted">
              Grobe Schätzung, hochgerechnet aus Band und Wiederholungen der bisherigen Einheiten. Sie verschiebt
              sich mit jeder neuen Einheit – nimm sie als Richtung, nicht als Termin.
            </p>
          </>
        ) : (
          <p className="muted small">
            Für eine Schätzung fehlt noch ein klarer Aufwärtstrend. Trag weiter ein, dann erscheint sie hier.
          </p>
        )}
      </div>
    </div>
  );
}
