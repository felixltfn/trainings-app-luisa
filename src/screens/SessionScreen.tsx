import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';

import { Picker } from '../Picker';
import { BAND_COLOR_NAMES, db, type Band, type FreeHeight, type Session } from '../db';
import { BAND_TARGET_TOP, buildPlan, fmtClock, fmtDate, isoDate, parseIsoDate } from '../logic';

interface Props {
  date?: string; // when entered from the calendar for another day
  onClose: () => void;
  onSaved: () => void;
}

// Rest after each band set: before set 2 and before the negatives. Nothing else is timed.
const REST_SECONDS = 120;
const REST_NEXT = ['Satz 2', 'die negativen Chin-Ups'];

interface Rest {
  after: number; // index of the band set that was just entered
  endsAt: number; // timestamp – iOS pauses JavaScript when the phone is put away
}

const HEIGHTS: { value: FreeHeight; label: string }[] = [
  { value: 'chin', label: 'Kinn über der Stange' },
  { value: 'half', label: 'etwa halbe Höhe' },
  { value: 'less', label: 'weniger als halbe Höhe' },
];

export function SessionScreen({ date, onClose, onSaved }: Props) {
  const data = useLiveQuery(async () => {
    const bands = (await db.bands.toArray()).sort((a, b) => a.order - b.order);
    const sessions = await db.sessions.toArray();
    return { bands, sessions };
  }, []);

  const [hang, setHang] = useState(false);
  const [hangSeconds, setHangSeconds] = useState('');
  const [reps, setReps] = useState(['', '']);
  const [bandId, setBandId] = useState<number | null>(null);
  const [negReps, setNegReps] = useState('');
  const [negSeconds, setNegSeconds] = useState('');
  const [hold, setHold] = useState('');
  const [freeTried, setFreeTried] = useState(false);
  const [freeDone, setFreeDone] = useState(false);
  const [freeHeight, setFreeHeight] = useState<FreeHeight>('half');
  const [error, setError] = useState('');
  const [rest, setRest] = useState<Rest | null>(null);
  const [restedAfter, setRestedAfter] = useState<number[]>([]); // each set starts its pause only once

  if (!data) return <div className="screen" />;
  const { bands, sessions } = data;
  const plan = buildPlan(sessions, bands);
  const chosenBand = bandId ?? plan.bandId;

  const num = (s: string) => {
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const save = async () => {
    if (reps.some((r) => num(r) <= 0)) {
      setError('Trag für beide Sätze ein, wie viele Wiederholungen du geschafft hast.');
      return;
    }
    if (!chosenBand) {
      setError('Wähle das Band aus, mit dem du gezogen hast.');
      return;
    }
    if (num(negReps) <= 0 || num(negSeconds) <= 0) {
      setError('Bei den negativen Chin-Ups fehlen die Wiederholungen oder die Sekunden.');
      return;
    }
    if (num(hold) <= 0) {
      setError('Trag ein, wie lange du oben gehalten hast.');
      return;
    }

    const session: Omit<Session, 'id'> = {
      date: date ?? isoDate(new Date()),
      timestamp: date ? parseIsoDate(date).getTime() : Date.now(),
      hang,
      hangSeconds: hang && num(hangSeconds) > 0 ? num(hangSeconds) : null,
      bandSets: reps.map((r) => ({ reps: num(r), bandId: chosenBand })),
      negativeReps: num(negReps),
      negativeSeconds: num(negSeconds),
      holdSeconds: num(hold),
      free: freeTried ? { done: freeDone, height: freeDone ? null : freeHeight } : null,
    };
    await db.sessions.add(session);
    onSaved();
  };

  // Only live training gets a pause, not entries for another day from the calendar
  const startRest = (set: number) => {
    if (date || num(reps[set]) <= 0 || restedAfter.includes(set)) return;
    setRestedAfter([...restedAfter, set]);
    setRest({ after: set, endsAt: Date.now() + REST_SECONDS * 1000 });
  };

  const planBand = bands.find((b) => b.id === plan.bandId);
  const bandOptions = bands.map((b: Band, i) => ({
    value: b.id,
    label: `${BAND_COLOR_NAMES[b.color] ?? 'Band'} · ${b.name}`,
    color: b.color,
    hint: i === 0 ? 'hilft am meisten' : i === bands.length - 1 ? 'hilft am wenigsten' : undefined,
  }));

  return (
    <div className="sheet">
      <div className="screen">
        <button className="back" onClick={onClose}>
          ‹ Zurück
        </button>
        <h1 className="title">Chin-Ups eintragen</h1>
        {date && <p className="muted">für den {fmtDate(date)}</p>}

        {plan.freeDue && (
          <div className="banner urgent section-sm">
            <span className="grow">
              Heute ist wieder ein freier Versuch ohne Band dran – am besten gleich nach dem Hang, wenn du noch
              frisch bist.
            </span>
          </div>
        )}

        {/* 0 – optional hang */}
        <section className="block">
          <p className="label">Vorher · freiwillig</p>
          <label className="check">
            <input type="checkbox" checked={hang} onChange={(e) => setHang(e.target.checked)} />
            An der Stange gehangen
          </label>
          {hang && (
            <label className="field">
              <span>Wie lange? (Sekunden, freiwillig)</span>
              <input
                className="num-input"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="z. B. 20"
                value={hangSeconds}
                onChange={(e) => setHangSeconds(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </label>
          )}
        </section>

        {/* Free attempt */}
        <section className="block">
          <p className="label">Freier Versuch ohne Band</p>
          <p className="goal">
            {plan.freeDue
              ? 'Heute fällig: ein Versuch, direkt nach dem Hang.'
              : `Erst wieder am ${plan.nextFreeDate ? fmtDate(plan.nextFreeDate) : '–'} dran – du kannst ihn aber jederzeit machen.`}
          </p>
          <label className="check">
            <input type="checkbox" checked={freeTried} onChange={(e) => setFreeTried(e.target.checked)} />
            Ich habe es ohne Band probiert
          </label>
          {freeTried && (
            <>
              <div className="segmented section-sm">
                <button className={freeDone ? 'on' : ''} onClick={() => setFreeDone(true)}>
                  Geschafft
                </button>
                <button className={!freeDone ? 'on' : ''} onClick={() => setFreeDone(false)}>
                  Nicht geschafft
                </button>
              </div>
              {!freeDone && (
                <div className="field">
                  <span>Wie hoch bist du gekommen?</span>
                  <Picker
                    title="Erreichte Höhe"
                    value={freeHeight}
                    options={HEIGHTS.map((h) => ({ value: h.value, label: h.label }))}
                    onChange={(v) => setFreeHeight(v as FreeHeight)}
                  />
                </div>
              )}
            </>
          )}
        </section>

        {/* 1 – banded chin-ups */}
        <section className="block">
          <p className="label">1 · Chin-Ups mit Band</p>
          <p className="goal">
            Ziel: beide Sätze mit <b>{plan.repTarget}</b> Wiederholungen,{' '}
            <span className="band-name">
              <span className="band-dot" style={{ background: planBand?.color }} />
              {plan.bandName}
            </span>
            .{plan.thickerHint && ' Nimm heute das dickere Band – damit ziehst du sauberer.'}
          </p>
          <div className="field">
            <span>Band</span>
            <Picker
              title="Welches Band?"
              value={chosenBand ?? ''}
              options={bandOptions}
              onChange={(v) => setBandId(Number(v))}
            />
          </div>
          <div className="pair">
            {reps.map((value, i) => (
              <label className="field" key={i}>
                <span>Satz {i + 1} · Wiederholungen</span>
                <input
                  className="num-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0"
                  value={value}
                  onChange={(e) => setReps(reps.map((r, j) => (i === j ? e.target.value : r)))}
                  onFocus={(e) => e.target.select()}
                  onBlur={() => startRest(i)}
                />
              </label>
            ))}
          </div>
        </section>

        {/* 2 – negatives */}
        <section className="block">
          <p className="label">2 · Negative Chin-Ups</p>
          <p className="goal">
            Ziel: <b>{plan.negative.reps}</b> Stück, dabei jeweils <b>{plan.negative.seconds}</b> Sekunden lang nach
            unten.
          </p>
          <div className="pair">
            <label className="field">
              <span>Wiederholungen</span>
              <input
                className="num-input"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={negReps}
                onChange={(e) => setNegReps(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <label className="field">
              <span>Sekunden pro Stück</span>
              <input
                className="num-input"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={String(plan.negative.seconds)}
                value={negSeconds}
                onChange={(e) => setNegSeconds(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </label>
          </div>
        </section>

        {/* 3 – hold */}
        <section className="block">
          <p className="label">3 · Oben halten</p>
          <p className="goal">
            Ziel: <b>{plan.holdTarget}</b> Sekunden{plan.holdDeeper ? ' aus gebeugten Armen (etwa 90 Grad)' : ''}.
          </p>
          <label className="field">
            <span>Sekunden</span>
            <input
              className="num-input"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={hold}
              onChange={(e) => setHold(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </label>
        </section>

        {error && <p className="banner section-sm">{error}</p>}

        <div className="section stack">
          <button className="btn block" onClick={save}>
            Einheit speichern
          </button>
          <button className="btn secondary block" onClick={onClose}>
            Abbrechen
          </button>
        </div>
        <p className="small muted section-sm">
          Das große Ziel: ein freier Chin-Up ohne Band. Beim dünnsten Band zweimal {BAND_TARGET_TOP} Wiederholungen
          heißt, dass du kurz davor bist.
        </p>
      </div>
      {rest && <RestBar rest={rest} onClose={() => setRest(null)} />}
    </div>
  );
}

function RestBar({ rest, onClose }: { rest: Rest; onClose: () => void }) {
  const [now, setNow] = useState(Date.now());
  const left = Math.ceil((rest.endsAt - now) / 1000);
  const done = left <= 0;

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  // Android buzzes, iOS ignores it – there the bar itself changes colour
  useEffect(() => {
    if (done) navigator.vibrate?.([200, 100, 200]);
  }, [done]);

  return (
    <div className={`rest-bar${done ? ' done' : ''}`} role="timer" aria-live={done ? 'assertive' : 'off'}>
      <div className="rest-progress" style={{ transform: `scaleX(${done ? 1 : 1 - left / REST_SECONDS})` }} />
      <div className="grow">
        <p className="rest-title">{done ? 'Pause vorbei' : `Pause ${fmtClock(left)}`}</p>
        <p className="small">{done ? `Weiter mit ${REST_NEXT[rest.after]}.` : `Danach ${REST_NEXT[rest.after]}.`}</p>
      </div>
      <button className="btn" onClick={onClose}>
        {done ? 'Los' : 'Überspringen'}
      </button>
    </div>
  );
}
