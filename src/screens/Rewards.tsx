import { useEffect, useRef, useState } from 'react';

import { CHAMBER_PIECES, PIECE_STEP, chamberState, potionSurface } from '../gamification';
import { WEEKLY_GOAL } from '../logic';

const asset = (name: string) => `${import.meta.env.BASE_URL}${name}`;

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

// ---------- Island ----------

interface ChamberSource {
  pixels: Uint8ClampedArray; // RGBA of the finished picture
  pieces: Uint8Array; // per pixel: the session number that brings it, 0 = empty
  size: number;
}

let chamberSource: Promise<ChamberSource> | null = null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Bild konnte nicht geladen werden: ${src}`));
    img.src = src;
  });
}

function readPixels(img: HTMLImageElement, size: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas wird nicht unterstützt');
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

// Loaded once, shared by the card and the full-screen view
function loadChamber(): Promise<ChamberSource> {
  chamberSource ??= Promise.all([loadImage(asset('chamber.webp')), loadImage(asset('chamber-pieces.png'))]).then(
    ([picture, map]) => {
      const size = map.naturalWidth;
      const mapPixels = readPixels(map, size);
      const pieces = new Uint8Array(size * size);
      for (let i = 0; i < pieces.length; i++) pieces[i] = Math.round(mapPixels[i * 4] / PIECE_STEP);
      return { pixels: readPixels(picture, size), pieces, size };
    },
  );
  return chamberSource;
}

// Draws only the pieces that match `keep`; everything else stays transparent
function paint(canvas: HTMLCanvasElement, source: ChamberSource, keep: (piece: number) => boolean) {
  canvas.width = source.size;
  canvas.height = source.size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const out = ctx.createImageData(source.size, source.size);
  for (let i = 0; i < source.pieces.length; i++) {
    const piece = source.pieces[i];
    if (piece === 0 || !keep(piece)) continue;
    const p = i * 4;
    out.data[p] = source.pixels[p];
    out.data[p + 1] = source.pixels[p + 1];
    out.data[p + 2] = source.pixels[p + 2];
    out.data[p + 3] = source.pixels[p + 3];
  }
  ctx.putImageData(out, 0, 0);
}

function ChamberPicture({ count }: { count: number }) {
  const island = useRef<HTMLCanvasElement>(null);
  const newest = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadChamber()
      .then((source) => {
        if (!alive || !island.current || !newest.current) return;
        paint(island.current, source, (piece) => piece < count);
        paint(newest.current, source, (piece) => piece === count);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Bild konnte nicht geladen werden'));
    return () => {
      alive = false;
    };
  }, [count]);

  if (error) return <p className="small muted">{error}</p>;

  return (
    <div className="chamber-img">
      {count === 0 && <span className="chamber-empty">Hier entsteht etwas</span>}
      <canvas ref={island} role="img" aria-label={`Deine Insel, ${count} von ${CHAMBER_PIECES} Teilen`} />
      <canvas ref={newest} className="chamber-new" aria-hidden="true" />
    </div>
  );
}

export function ChamberCard({ units }: { units: number }) {
  const [open, setOpen] = useState(false);
  const { count, complete } = chamberState(units);
  const left = CHAMBER_PIECES - count;

  const caption = complete
    ? 'Das Bild ist vollständig.'
    : count === 0
      ? 'Jede Einheit bringt ein Teil.'
      : 'Das neueste Teil leuchtet.';

  return (
    <>
      <button className="reward chamber" onClick={() => setOpen(true)}>
        <ChamberPicture count={count} />
        <span className="reward-num">
          {count}
          <span className="muted"> / {CHAMBER_PIECES}</span>
        </span>
        <span className="small muted">{caption}</span>
      </button>

      {open && (
        <div className="sheet">
          <div className="screen">
            <button className="back" onClick={() => setOpen(false)}>
              ‹ Zurück
            </button>
            <p className="label section-sm">Deine Insel</p>
            <h1 className="title">
              {count} von {CHAMBER_PIECES}
            </h1>
            <p className="muted">
              Jede Einheit – Chin-Ups oder Yoga – bringt ein Teil.{' '}
              {complete
                ? 'Du hast alles geschafft, das Bild ist vollständig.'
                : `Noch ${left} ${left === 1 ? 'Einheit' : 'Einheiten'}, dann siehst du das ganze Bild.`}
            </p>
            <div className="section-sm">
              <ChamberPicture count={count} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Strength flask ----------

export function PotionCard({ level }: { level: number }) {
  const percent = Math.round(level * 100);

  return (
    <div className="reward potion">
      <div className="potion-img">
        <img src={asset('potion-empty.webp')} alt="" />
        {/* Only the liquid itself is cut, the glass, cork and tag never change */}
        <img
          className="potion-liquid"
          src={asset('potion-liquid.webp')}
          alt={`Kraft-Fläschchen, ${percent} Prozent voll`}
          style={{ clipPath: `inset(${potionSurface(level)}% 0 0 0)` }}
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
