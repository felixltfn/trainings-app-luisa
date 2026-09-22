import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';

import { DEFAULT_BODYWEIGHT, db, getMeta } from '../db';
import { potionLevel } from '../gamification';
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
import { countInWeek, weekStreak } from '../stats';
import { loadStart, minutesSince, saveStart } from '../yogaTimer';
import { ChamberCard, PotionCard, StreakBanner } from './Rewards';
import { SessionScreen } from './SessionScreen';

export function TodayScreen() {
  const [entering, setEntering] = useState(false);
  const [toYoga, setToYoga] = useState(false); // straight from the session to the yoga start
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
    const bodyweight = (await getMeta<number>('bodyweight')) ?? DEFAULT_BODYWEIGHT;
    return { bands, sessions, yoga, bodyweight };
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
  const { bands, sessions, yoga, bodyweight } = data;

  if (entering) {
    return (
      <SessionScreen
        onClose={() => setEntering(false)}
        onSaved={() => {
          setEntering(false);
          setToYoga(true);
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

  // Right after saving the session: nothing but the way into the yoga session
  if (toYoga && !startedAt) {
    return (
      <div className="screen">
        <p className="label">Chin-Ups gespeichert</p>
        <h1 className="title">Weiter mit Yoga</h1>
        <p className="muted">Starte die Zeit, wenn du loslegst. Sie läuft weiter, auch wenn du das Handy weglegst.</p>
        <button
          className="btn block section"
          onClick={() => {
            startYoga();
            setToYoga(false);
          }}
        >
          Yoga starten
        </button>
        <button className="btn secondary block section-sm" onClick={() => setToYoga(false)}>
          Heute kein Yoga
        </button>
      </div>
    );
  }

  // While yoga runs she has put the phone away – nothing about chin-ups on screen
  if (startedAt && stopping === null) {
    return (
      <div className="screen">
        <p className="label">Yoga läuft</p>
        <h1 className="title">{fmtClock((now - startedAt) / 1000)}</h1>
        <p className="muted">
          Gestartet um {new Date(startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}. Die
          Zeit läuft weiter, auch wenn du die App schließt.
        </p>
        <button className="btn block section" onClick={stopYoga}>
          Stopp
        </button>
      </div>
    );
  }

  return (
    <div className="screen">
      <p className="label">
        {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
      <h1 className="title">Heute</h1>

      <div className="section">
        <StreakBanner
          chinStreak={weekStreak(sessions.map((s) => s.date))}
          yogaStreak={weekStreak(yoga.map((y) => y.date))}
          chinThisWeek={chinThisWeek}
        />
      </div>

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
        <ol className="plan-list">
          <li>
            <span className="plan-step">1</span>
            <span className="plan-what">
              Zwei Sätze mit Band
              <span className="band-name plan-sub">
                <span className="band-dot" style={{ background: bands.find((b) => b.id === plan.bandId)?.color }} />
                {plan.bandName}
              </span>
            </span>
            <span className="plan-value">
              {plan.repTarget}
              <small>× je Satz</small>
            </span>
          </li>
          <li>
            <span className="plan-step">2</span>
            <span className="plan-what">
              Negative Chin-Ups
              <span className="plan-sub">je {plan.negative.seconds} Sekunden ablassen</span>
            </span>
            <span className="plan-value">
              {plan.negative.reps}
              <small>×</small>
            </span>
          </li>
          <li>
            <span className="plan-step">3</span>
            <span className="plan-what">
              Oben halten
              <span className="plan-sub">Kinn über der Stange</span>
            </span>
            <span className="plan-value">
              {plan.holdTarget}
              <small>Sek.</small>
            </span>
          </li>
          {plan.freeDue && (
            <li>
              <span className="plan-step">4</span>
              <span className="plan-what">
                Freier Versuch
                <span className="plan-sub">ohne Band, einmal probieren</span>
              </span>
              <span className="plan-value">
                1<small>×</small>
              </span>
            </li>
          )}
        </ol>
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
              {manual ? 'Abbrechen' : 'Manuell eintragen'}
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
              Eintragen
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

      {/* Rewards: the island grows with every session, the flask fills with strength */}
      <div className="section">
        <p className="label">Deine Insel</p>
        <div className="rewards">
          <ChamberCard units={sessions.length + yoga.length} />
          <PotionCard level={potionLevel(sessions, bands, bodyweight)} />
        </div>
      </div>
    </div>
  );
}
