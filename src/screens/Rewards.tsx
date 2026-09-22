import { useState } from 'react';

import { CHAMBER_SPOTS, POTION_NECK, chamberMask, chamberState, potionSurface } from '../gamification';
import { WEEKLY_GOAL } from '../logic';

const CHAMBER_SRC = `${import.meta.env.BASE_URL}chamber.webp`;
const POTION_SRC = `${import.meta.env.BASE_URL}potion.webp`;

const weeks = (n: number) => (n === 1 ? '1 Woche' : `${n} Wochen`);

// ---------- Streak ----------

interface StreakProps {
  chinStreak: number;
  yogaStreak: number;
  chinThisWeek: number;
}

export function StreakBanner({ chinStreak, yogaStreak, chinThisWeek }: StreakProps) {
  const missing = Math.max(0, WEEKLY_GOAL - chinThisWeek);
  const hint =
    missing === 0
      ? 'Diese Woche ist geschafft.'
      : `Noch ${missing} Chin-Up-${missing === 1 ? 'Einheit' : 'Einheiten'}, dann zählt auch diese Woche.`;

  return (
    <div className={`streak${chinStreak > 0 ? ' lit' : ''}`}>
      <svg className="streak-flame" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2c1 3.5 5 5.8 5 10.5A5 5 0 0 1 7 12.5c0-2 1-3.5 2.2-4.6.2 1.6 1 2.6 2 3C11 8 11.2 5 12 2Z" />
      </svg>
      <div className="grow">
        <p className="streak-title">{chinStreak > 0 ? `${weeks(chinStreak)} in Folge` : 'Deine Serie startet'}</p>
        <p className="small muted">
          {hint} Yoga: {yogaStreak > 0 ? `${weeks(yogaStreak)} in Folge` : 'Serie startet'}.
        </p>
      </div>
    </div>
  );
}

// ---------- Chamber ----------

export function ChamberCard({ units }: { units: number }) {
  const [open, setOpen] = useState(false);
  const state = chamberState(units);
  const mask = chamberMask(state.revealed);

  const picture = (
    <div className="chamber-img">
      <img className="chamber-base" src={CHAMBER_SRC} alt="" />
      <img
        className="chamber-color"
        src={CHAMBER_SRC}
        alt={`Deine Kammer, ${state.revealed.length} von ${CHAMBER_SPOTS.length} Dingen erwacht`}
        style={state.complete ? undefined : { WebkitMaskImage: mask, maskImage: mask }}
      />
      {state.newest && !state.complete && (
        <span
          className="chamber-spark"
          style={{ left: `${state.newest.x}%`, top: `${state.newest.y}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );

  const caption = state.complete
    ? 'Die Kammer ist vollständig.'
    : state.newest
      ? `Neu: ${state.newest.name}`
      : 'Mit jeder Einheit erwacht ein Ding.';

  return (
    <>
      <button className="reward chamber" onClick={() => setOpen(true)}>
        {picture}
        <span className="reward-num">
          {state.revealed.length}
          <span className="muted"> / {CHAMBER_SPOTS.length}</span>
        </span>
        <span className="small muted">{caption}</span>
      </button>

      {open && (
        <div className="sheet">
          <div className="screen">
            <button className="back" onClick={() => setOpen(false)}>
              ‹ Zurück
            </button>
            <p className="label section-sm">Deine Kammer</p>
            <h1 className="title">
              {state.revealed.length} von {CHAMBER_SPOTS.length}
            </h1>
            <p className="muted">
              Jede Einheit – Chin-Ups oder Yoga – erweckt ein Ding in der Kammer zum Leben.
              {state.next && ` Als Nächstes: ${state.next.name}.`}
            </p>
            <div className="section-sm">{picture}</div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Strength flask ----------

export function PotionCard({ level }: { level: number }) {
  const surface = potionSurface(level);
  const percent = Math.round(level * 100);

  return (
    <div className="reward potion">
      <div className="potion-img">
        <img className="potion-empty" src={POTION_SRC} alt="" />
        <img className="potion-fill" src={POTION_SRC} alt="" style={{ clipPath: `inset(0 0 ${100 - POTION_NECK}% 0)` }} />
        <img
          className="potion-fill potion-liquid"
          src={POTION_SRC}
          alt={`Kraft-Fläschchen, ${percent} Prozent voll`}
          style={{ clipPath: `inset(${surface}% 0 0 0)` }}
        />
      </div>
      <span className="reward-num">
        {percent}
        <span className="muted"> %</span>
      </span>
      <span className="small muted">{level >= 1 ? 'Voll – ohne Band!' : 'Voll heißt: ohne Band'}</span>
    </div>
  );
}
