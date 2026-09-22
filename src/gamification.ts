import type { Band, Session } from './db';
import { sessionE1rm } from './stats';

// ---------- The chamber: every session (chin-ups or yoga) colours in one more object ----------

export interface ChamberSpot {
  name: string; // with article, e.g. "der Kessel"
  x: number; // centre in % of the image width
  y: number; // centre in % of the image height
  r: number; // radius in % of the image width (the image is square)
}

// Positions measured on public/chamber.webp, in the order they appear
export const CHAMBER_SPOTS: ChamberSpot[] = [
  { name: 'der Kessel', x: 53, y: 41, r: 10 },
  { name: 'die schlafende Katze', x: 35, y: 50, r: 9 },
  { name: 'das runde Fenster', x: 38, y: 27, r: 8 },
  { name: 'der rosa Kristall', x: 17, y: 60, r: 6 },
  { name: 'die Eule', x: 85, y: 26, r: 6 },
  { name: 'das Regal mit den Tränken', x: 70, y: 26, r: 8 },
  { name: 'die Kräuterbündel', x: 58, y: 14, r: 8 },
  { name: 'das Fernrohr', x: 43, y: 35, r: 5 },
  { name: 'die oberen Bücher', x: 21, y: 29, r: 8 },
  { name: 'der Sternenteppich', x: 44, y: 68, r: 11 },
  { name: 'das Astrolabium', x: 76, y: 39, r: 6 },
  { name: 'die Pilze', x: 83, y: 64, r: 7 },
  { name: 'der Besen', x: 90, y: 59, r: 6 },
  { name: 'der Schreibtisch mit der Karte', x: 70, y: 53, r: 8 },
  { name: 'die unteren Bücher', x: 20, y: 45, r: 7 },
  { name: 'der Hocker', x: 65, y: 63, r: 5 },
  { name: 'die Laterne', x: 53, y: 78, r: 4 },
  { name: 'die Teppichrolle', x: 64, y: 75, r: 8 },
  { name: 'die Treppe', x: 30, y: 82, r: 9 },
  { name: 'die Fensterkerzen', x: 33, y: 20, r: 5 },
  { name: 'der Wandteppich', x: 85, y: 46, r: 5 },
  { name: 'die Tasse auf den Büchern', x: 45, y: 47, r: 4 },
  { name: 'die schwebenden Kerzen', x: 55, y: 24, r: 5 },
  { name: 'die Kerze ganz oben', x: 44, y: 10, r: 4 },
  { name: 'der Efeu oben', x: 30, y: 7, r: 6 },
  { name: 'die Blumen am Tisch', x: 67, y: 41, r: 5 },
  { name: 'die Truhen im Regal', x: 23, y: 54, r: 5 },
  { name: 'die Glaskugel', x: 16, y: 44, r: 4 },
  { name: 'der Efeu links', x: 8, y: 35, r: 7 },
  { name: 'der Efeu rechts', x: 92, y: 35, r: 6 },
];

export interface ChamberState {
  revealed: ChamberSpot[];
  newest: ChamberSpot | null;
  next: ChamberSpot | null;
  complete: boolean;
}

export function chamberState(units: number): ChamberState {
  const count = Math.min(Math.max(0, units), CHAMBER_SPOTS.length);
  const revealed = CHAMBER_SPOTS.slice(0, count);
  return {
    revealed,
    newest: revealed[revealed.length - 1] ?? null,
    next: CHAMBER_SPOTS[count] ?? null,
    complete: count === CHAMBER_SPOTS.length,
  };
}

const MASK_GROW = 1.3; // the measured radii hug the objects; a little more reads better

// One soft circle per object; the colour layer only shows through these
export function chamberMask(spots: ChamberSpot[]): string {
  if (spots.length === 0) return 'linear-gradient(transparent, transparent)';
  return spots
    .map((s) => {
      const r = s.r * MASK_GROW;
      return `radial-gradient(${r}% ${r}% at ${s.x}% ${s.y}%, #000 65%, transparent 100%)`;
    })
    .join(', ');
}

// ---------- The strength flask: estimated strength against her bodyweight ----------

export const POTION_WINDOW = 3; // recent sessions averaged, so one bad day barely moves it

// Liquid range measured on public/potion.webp, in % of the image height
export const POTION_LIQUID_TOP = 30;
export const POTION_LIQUID_BOTTOM = 98;
export const POTION_NECK = 28.5; // cork and brass above this line always stay in colour

// 0..1 – full means strong enough for a chin-up without a band
export function potionLevel(sessions: Session[], bands: Band[], bodyweight: number): number {
  if (sessions.some((s) => s.free?.done)) return 1;
  const recent = [...sessions]
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((s) => sessionE1rm(s, bands, bodyweight))
    .filter((v): v is number => v !== null)
    .slice(-POTION_WINDOW);
  if (recent.length === 0 || bodyweight <= 0) return 0;
  const average = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Math.min(1, Math.max(0, average / bodyweight));
}

// Where the liquid surface sits, in % from the top of the image
export function potionSurface(level: number): number {
  return POTION_LIQUID_BOTTOM - level * (POTION_LIQUID_BOTTOM - POTION_LIQUID_TOP);
}
