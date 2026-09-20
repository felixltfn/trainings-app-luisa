import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';

import { db } from '../db';
import {
  BIG_GOAL_DATE,
  WEEKLY_GOAL,
  buildPlan,
  daysBetween,
  fmtClock,
  fmtDate,
  fmtMinutes,
  freeHeightLabel,
  isoDate,
  weekStart,
} from '../logic';
import { countInWeek } from '../stats';
import { loadStart, minutesSince, saveStart } from '../yogaTimer';
import { SessionScreen } from './SessionScreen';

export function TodayScreen() {
  const [entering, setEntering] = useState(false);
  const [feedback, setFeedback] = useState<string[] | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(loadStart);
  const [stopping, setStopping] = useState<number | null>(null); // minutes, editable before saving
  const [manual, setManual] = useState(false);
  const [manualDate, setManualDate] = useState(isoDate(new Date()));
  const [manualMinutes, setManualMinutes] = useState('45');
  const [now, setNow] = useState(Date.now());

  const data = useLiveQuery(async () => {
    const bands = (await db.bands.toArray()).sort((a, b) => a.order - b.order);
    const sessions = await db.sessions.toArray();
    const yoga = await db.yoga.toArray();
    return { bands, sessions, yoga };
  }, []);

  // The running yoga timer is recomputed from its start time, so closing the app is fine
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  if (!data) return <div className="screen" />;
  const { bands, sessions, yoga } = data;

  if (entering) {
    return (
      <SessionScreen
        onClose={() => setEntering(false)}
        onSaved={(lines) => {
          setEntering(false);
          setFeedback(lines);
        }}
      />
    );
  }

  const monday = weekStart(new Date());
  const chinThisWeek = countInWeek(sessions.map((s) => s.date), monday);
  const yogaThisWeek = countInWeek(yoga.map((y) => y.date), monday);
  const plan = buildPlan(sessions, bands);
  const last = [...sessions].sort((a, b) => a.timestamp - b.timestamp).pop();
  const daysToGoal = daysBetween(isoDate(new Date()), BIG_GOAL_DATE);

  const startYoga = () => {
    const t = Date.now();
    setStartedAt(t);
    saveStart(t);
  };

  const stopYoga = () => {
    if (!startedAt) return;
    setStopping(minutesSince(startedAt, Date.now()));
  };

  const saveYoga = async (minutes: number, date: string) => {
    await db.yoga.add({ date, minutes: Math.max(1, Math.round(minutes)) });
    setStartedAt(null);
    saveStart(null);
    setStopping(null);
    setManual(false);
  };

  return (
    <div className="screen">
      <p className="label">
        {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
      <h1 className="title">Heute</h1>

      {feedback && (
        <div className="feedback section-sm">
          <p className="label">Für das nächste Mal</p>
          {feedback.map((line) => (
            <p key={line}>{line}</p>
          ))}
          <div className="row section-sm">
            {!startedAt && (
              <button
                className="btn grow"
                onClick={() => {
                  startYoga();
                  setFeedback(null);
                }}
              >
                Yoga starten
              </button>
            )}
            <button className="btn secondary grow" onClick={() => setFeedback(null)}>
              Verstanden
            </button>
          </div>
        </div>
      )}

      <div className="stats-row section">
        <div className="stat">
          <p className="label">Chin-Ups</p>
          <div className="big-num">
            {chinThisWeek}
            <span className="muted"> / {WEEKLY_GOAL}</span>
          </div>
          <p className="small muted">diese Woche</p>
        </div>
        <div className="stat">
          <p className="label">Yoga</p>
          <div className="big-num">
            {yogaThisWeek}
            <span className="muted"> / {WEEKLY_GOAL}</span>
          </div>
          <p className="small muted">diese Woche</p>
        </div>
        <div className="stat">
          <p className="label">Bis zum Ziel</p>
          <div className="big-num">{Math.max(0, Math.ceil(daysToGoal / 7))}</div>
          <p className="small muted">Wochen</p>
        </div>
      </div>

      {/* Chin-up session */}
      <div className="section">
        <p className="label">Chin-Up-Einheit</p>
        <p className="goal">
          Heute: beide Sätze mit <b>{plan.repTarget}</b> Wiederholungen, Band <b>{plan.bandName}</b>,{' '}
          <b>{plan.negative.reps}</b> mal langsam ablassen mit je <b>{plan.negative.seconds}</b> Sekunden, oben{' '}
          <b>{plan.holdTarget}</b> Sekunden halten.
          {plan.freeDue && ' Dazu ist ein freier Versuch ohne Band fällig.'}
        </p>
        <button className="btn block" onClick={() => setEntering(true)}>
          Chin-Ups eintragen
        </button>
        {last && (
          <p className="small muted section-sm">
            Zuletzt am {fmtDate(last.date)}: {last.bandSets.map((s) => s.reps).join(' und ')} Wiederholungen,{' '}
            {last.holdSeconds} Sekunden gehalten
            {last.free ? `, freier Versuch ${last.free.done ? 'geschafft' : freeHeightLabel(last.free.height)}` : ''}.
          </p>
        )}
      </div>

      {/* Yoga */}
      <div className="section">
        <p className="label">Yoga oder Pilates</p>

        {startedAt && stopping === null && (
          <div className="running section-sm">
            <div className="grow">
              <div className="big-num">{fmtClock((now - startedAt) / 1000)}</div>
              <div className="small">läuft seit {new Date(startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <button className="btn" onClick={stopYoga}>
              Stopp
            </button>
          </div>
        )}

        {stopping !== null && (
          <div className="section-sm">
            <label className="field">
              <span>Dauer in Minuten – überschreib sie, falls du das Stoppen vergessen hast</span>
              <input
                className="num-input"
                inputMode="numeric"
                pattern="[0-9]*"
                value={stopping}
                onChange={(e) => setStopping(Number(e.target.value) || 0)}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <div className="row section-sm">
              <button className="btn grow" onClick={() => saveYoga(stopping, isoDate(new Date()))}>
                Einheit speichern
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  setStopping(null);
                  setStartedAt(null);
                  saveStart(null);
                }}
              >
                Verwerfen
              </button>
            </div>
          </div>
        )}

        {!startedAt && stopping === null && (
          <div className="stack section-sm">
            <button className="btn block" onClick={startYoga}>
              Yoga starten
            </button>
            <button className="btn secondary block" onClick={() => setManual(!manual)}>
              {manual ? 'Abbrechen' : 'Einheit nachtragen'}
            </button>
          </div>
        )}

        {manual && !startedAt && (
          <div className="section-sm">
            <div className="pair">
              <label className="field">
                <span>Datum</span>
                <input
                  className="input"
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Minuten</span>
                <input
                  className="num-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </label>
            </div>
            <button
              className="btn block section-sm"
              onClick={() => saveYoga(Number(manualMinutes) || 0, manualDate)}
            >
              Nachtragen
            </button>
          </div>
        )}

        {yoga.length > 0 && (
          <p className="small muted section-sm">
            Zuletzt: {fmtDate([...yoga].sort((a, b) => a.date.localeCompare(b.date)).pop()!.date)} ·{' '}
            {fmtMinutes([...yoga].sort((a, b) => a.date.localeCompare(b.date)).pop()!.minutes)}
          </p>
        )}
      </div>
    </div>
  );
}
