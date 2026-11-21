// Micro-sim: where every agent stands at a given world millisecond.
// Pure integer fixed-point math: 1 tile = 256 units, 1 world pixel = 16 units.
import { MAP_W, PLACES_GEO, AREA_TILES } from './map';
import { paths } from './path';
import { placeOf } from '../sim/routine';
import { CH, key, mix } from '../sim/prng';
import { HOUR_MINUTES } from '../sim/config';
import type { WorldState } from '../sim/state';

export const UNIT = 256;
const WORLD_MS_PER_MIN = 60_000;
const SPEED = 4 * UNIT;                  // units per world minute (4 tiles/min)
const WANDER_SLOT = 6 * WORLD_MS_PER_MIN; // a new hangout spot every 6 world minutes
const WANDER_MOVE = 90_000;               // reach it within 90 world seconds

export type Pose = {
  slot: number; uid: number;
  x: number; y: number;      // units
  dir: number;               // 0 down, 1 left, 2 right, 3 up
  moving: boolean;
  place: number;             // destination place
  dying: boolean;
  newborn: boolean;
};

type Pt = { x: number; y: number };
const tileCenter = (t: Pt): Pt => ({ x: t.x * UNIT + 128, y: t.y * UNIT + 128 });
const idxCenter = (i: number): Pt => ({ x: (i % MAP_W) * UNIT + 128, y: ((i / MAP_W) | 0) * UNIT + 128 });

function poi(place: number, uid: number, w: number): Pt {
  const tiles = AREA_TILES[place];
  const t = tiles[key(CH.WANDER, uid, w, place) % tiles.length];
  const p = tileCenter(t);
  // per-agent sub-tile jitter so a crowd does not stack perfectly
  const j = mix(uid * 7919 + w);
  return { x: p.x + ((j & 63) - 32), y: p.y + (((j >>> 8) & 63) - 32) };
}

function lerp(a: Pt, b: Pt, num: number, den: number): Pt {
  if (den <= 0 || num >= den) return { x: b.x, y: b.y };
  if (num <= 0) return { x: a.x, y: a.y };
  return { x: a.x + Math.trunc(((b.x - a.x) * num) / den), y: a.y + Math.trunc(((b.y - a.y) * num) / den) };
}
function dirOf(dx: number, dy: number, fallback = 0): number {
  if (dx === 0 && dy === 0) return fallback;
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 1 : 2) : dy < 0 ? 3 : 0;
}
const dist = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Wandering inside a place. `since` = world ms when the agent arrived (anchor). */
function wander(place: number, uid: number, tw: number, since: number): { p: Pt; moving: boolean; dir: number } {
  const anchor = tileCenter(PLACES_GEO[place].anchor);
  const w = Math.floor(tw / WANDER_SLOT);
  const slotStart = w * WANDER_SLOT;
  // Arrived during this slot: wait at the anchor until the next slot.
  if (slotStart < since) return { p: anchor, moving: false, dir: 0 };
  const to = poi(place, uid, w);
  const from = slotStart - WANDER_SLOT < since ? anchor : poi(place, uid, w - 1);
  const t = tw - slotStart;
  const moving = t < WANDER_MOVE && dist(from, to) > 16;
  return { p: lerp(from, to, t, WANDER_MOVE), moving, dir: dirOf(to.x - from.x, to.y - from.y) };
}

/** Walk along a polyline of points at SPEED. */
function along(pts: Pt[], elapsedMs: number): { p: Pt; dir: number; done: boolean } {
  let d = Math.floor((elapsedMs * SPEED) / WORLD_MS_PER_MIN);
  for (let k = 1; k < pts.length; k++) {
    const seg = dist(pts[k - 1], pts[k]);
    if (d <= seg) return { p: lerp(pts[k - 1], pts[k], d, seg), dir: dirOf(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y), done: false };
    d -= seg;
  }
  const last = pts[pts.length - 1];
  return { p: last, dir: 0, done: true };
}
function polyLength(pts: Pt[]): number { let L = 0; for (let k = 1; k < pts.length; k++) L += dist(pts[k - 1], pts[k]); return L; }

/**
 * prev = state current during hour H-1 (hour field = H), cur = state for hour H (hour field = H+1).
 * tw = world milliseconds since Genesis.
 */
export function poseAt(prev: WorldState, cur: WorldState, slot: number, tw: number): Pose | null {
  const H = Math.floor(tw / (HOUR_MINUTES * WORLD_MS_PER_MIN));
  const hourStart = H * HOUR_MINUTES * WORLD_MS_PER_MIN;
  const a = cur.agents[slot]; const pa = prev.agents[slot];
  const same = pa && pa.uid === a.uid && pa.alive;
  if (!a.alive && !(same && pa.alive)) return null;
  // Died during this hour: show the collapse where they were.
  if (!a.alive && same) {
    const pl = placeOf(prev, slot, H - 1); if (pl < 0) return null;
    const w = wander(pl, a.uid, hourStart, hourStart - WANDER_SLOT * 2);
    return { slot, uid: a.uid, x: w.p.x, y: w.p.y, dir: 0, moving: false, place: pl, dying: true, newborn: false };
  }
  const to = placeOf(cur, slot, H);
  const from = same ? placeOf(prev, slot, H - 1) : PLACES_GEO[0].id; // newborns step out of The Stacks
  const depart = hourStart + (key(CH.DEPART, a.uid, H) % 18) * WORLD_MS_PER_MIN;
  const newborn = !same;

  if (from === to || from < 0) {
    const since = from === to ? hourStart - HOUR_MINUTES * WORLD_MS_PER_MIN : hourStart;
    const w = wander(to, a.uid, tw, since);
    return { slot, uid: a.uid, x: w.p.x, y: w.p.y, dir: w.dir, moving: w.moving, place: to, dying: false, newborn };
  }
  if (tw < depart) {
    const w = wander(from, a.uid, tw, hourStart - HOUR_MINUTES * WORLD_MS_PER_MIN);
    return { slot, uid: a.uid, x: w.p.x, y: w.p.y, dir: w.dir, moving: w.moving, place: from, dying: false, newborn };
  }
  const startPt = wander(from, a.uid, depart, hourStart - HOUR_MINUTES * WORLD_MS_PER_MIN).p;
  const route = paths()[from][to];
  const pts: Pt[] = [startPt, ...route.map(idxCenter)];
  const walk = along(pts, tw - depart);
  if (!walk.done) return { slot, uid: a.uid, x: walk.p.x, y: walk.p.y, dir: walk.dir, moving: true, place: to, dying: false, newborn };
  const arrival = depart + Math.ceil((polyLength(pts) * WORLD_MS_PER_MIN) / SPEED);
  const w = wander(to, a.uid, tw, arrival);
  return { slot, uid: a.uid, x: w.p.x, y: w.p.y, dir: w.dir, moving: w.moving, place: to, dying: false, newborn };
}

export function allPoses(prev: WorldState, cur: WorldState, tw: number): Pose[] {
  const out: Pose[] = [];
  for (let i = 0; i < cur.agents.length; i++) { const p = poseAt(prev, cur, i, tw); if (p) out.push(p); }
  out.sort((a, b) => a.y - b.y || a.uid - b.uid);
  return out;
}
