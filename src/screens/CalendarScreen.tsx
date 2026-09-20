import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';

import { db } from '../db';
import { fmtDate, fmtMinutes, freeHeightLabel, isoDate } from '../logic';
import { SessionScreen } from './SessionScreen';

const DOW = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function CalendarScreen() {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const touchX = useRef<number | null>(null);

  const data = useLiveQuery(async () => {
    const sessions = await db.sessions.toArray();
    const yoga = await db.yoga.toArray();
    const bands = await db.bands.toArray();
    return { sessions, yoga, bands };
  }, []);

  if (!data) return <div className="screen" />;
  const { sessions, yoga, bands } = data;

  const year = month.getFullYear();
  const m = month.getMonth();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const leading = (new Date(year, m, 1).getDay() + 6) % 7; // Monday = 0
  const cells = Array.from({ length: Math.ceil((leading + daysInMonth) / 7) * 7 }, (_, i) =>
    new Date(year, m, i - leading + 1),
  );
  const shift = (delta: number) => setMonth(new Date(year, m + delta, 1));

  const prefix = `${year}-${String(m + 1).padStart(2, '0')}`;
  const chinCount = sessions.filter((s) => s.date.startsWith(prefix)).length;
  const yogaCount = yoga.filter((y) => y.date.startsWith(prefix)).length;

  return (
    <div className="screen">
      <p className="label">Kalender</p>
      <div className="spread">
        <h1 className="title">{month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</h1>
        <div className="row">
          <button className="icon-btn" aria-label="Vorheriger Monat" onClick={() => shift(-1)}>
            ‹
          </button>
          <button className="icon-btn" aria-label="Nächster Monat" onClick={() => shift(1)}>
            ›
          </button>
        </div>
      </div>

      <div className="stats-row two section-sm">
        <div className="stat">
          <p className="label">Chin-Ups</p>
          <div className="big-num">{chinCount}</div>
        </div>
        <div className="stat">
          <p className="label">Yoga</p>
          <div className="big-num">{yogaCount}</div>
        </div>
      </div>

      <div
        className="cal-grid section"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) shift(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((d) => {
          const iso = isoDate(d);
          const hasChin = sessions.some((s) => s.date === iso);
          const hasYoga = yoga.some((y) => y.date === iso);
          const classes = [
            'cal-day',
            d.getMonth() !== m ? 'other' : '',
            iso === isoDate(today) ? 'today' : '',
            hasChin || hasYoga ? 'has' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button key={iso} className={classes} onClick={() => setOpenDay(iso)}>
              <span className="d">{d.getDate()}</span>
              <span className="marks">
                {hasChin && <span className="mark chin" />}
                {hasYoga && <span className="mark yoga" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="legend section-sm">
        <span>
          <span className="mark chin" /> Chin-Ups
        </span>
        <span>
          <span className="mark yoga" /> Yoga
        </span>
      </div>

      {openDay && <DayView date={openDay} bands={bands} onClose={() => setOpenDay(null)} />}
    </div>
  );
}

function DayView({
  date,
  bands,
  onClose,
}: {
  date: string;
  bands: { id: number; name: string; color: string }[];
  onClose: () => void;
}) {
  const [entering, setEntering] = useState(false);
  const [minutes, setMinutes] = useState('45');

  const data = useLiveQuery(async () => {
    const sessions = await db.sessions.where('date').equals(date).toArray();
    const yoga = await db.yoga.where('date').equals(date).toArray();
    return { sessions, yoga };
  }, [date]);

  if (!data) return <div className="sheet" />;
  if (entering) return <SessionScreen date={date} onClose={() => setEntering(false)} onSaved={() => setEntering(false)} />;

  const { sessions, yoga } = data;

  const addYoga = async () => {
    const n = Number(minutes.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return;
    await db.yoga.add({ date, minutes: Math.round(n) });
  };

  return (
    <div className="sheet">
      <div className="screen">
        <button className="back" onClick={onClose}>
          ‹ Kalender
        </button>
        <h1 className="title">{fmtDate(date)}</h1>

        <div className="section">
          <p className="label">Chin-Ups</p>
          {sessions.length === 0 ? (
            <p className="muted small">Keine Einheit an diesem Tag.</p>
          ) : (
            sessions.map((s) => {
              const band = bands.find((b) => b.id === s.bandSets[0]?.bandId);
              return (
                <div key={s.id} className="day-entry">
                  <p>
                    <span className="band-name">
                      <span className="band-dot" style={{ background: band?.color }} />
                      {band?.name ?? 'Band'}
                    </span>{' '}
                    · {s.bandSets.map((x) => x.reps).join(' und ')} Wiederholungen
                  </p>
                  <p className="small muted">
                    {s.negativeReps} negative mit je {s.negativeSeconds} s · {s.holdSeconds} s gehalten
                    {s.hang ? ` · gehangen${s.hangSeconds ? ` ${s.hangSeconds} s` : ''}` : ''}
                    {s.free ? ` · freier Versuch: ${s.free.done ? 'geschafft' : freeHeightLabel(s.free.height)}` : ''}
                  </p>
                  <button className="btn danger" onClick={() => db.sessions.delete(s.id)}>
                    Löschen
                  </button>
                </div>
              );
            })
          )}
          <button className="btn secondary block section-sm" onClick={() => setEntering(true)}>
            Chin-Ups für diesen Tag eintragen
          </button>
        </div>

        <div className="section">
          <p className="label">Yoga</p>
          {yoga.length === 0 ? (
            <p className="muted small">Keine Einheit an diesem Tag.</p>
          ) : (
            yoga.map((y) => (
              <div key={y.id} className="day-entry">
                <p>{fmtMinutes(y.minutes)}</p>
                <button className="btn danger" onClick={() => db.yoga.delete(y.id)}>
                  Löschen
                </button>
              </div>
            ))
          )}
          <div className="row section-sm">
            <input
              className="num-input grow"
              inputMode="numeric"
              pattern="[0-9]*"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
            <button className="btn" onClick={addYoga}>
              + Minuten
            </button>
          </div>
        </div>

        <button className="btn secondary block section" onClick={onClose}>
          Fertig
        </button>
      </div>
    </div>
  );
}
