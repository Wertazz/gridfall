// When many eyes gather over a place, agents notice. Display only — never touches the state.
import { key, CH } from '../sim/prng';
import { PLACES_GEO, TILE } from '../micro/map';
import { eyesLine } from './grammar';
import type { View } from '../world/engine';
import type { Bubble, Eye } from '../render/renderer';

const WINDOW = 4; // world minutes

export function eyesBubbles(v: View, eyes: Eye[]): Bubble[] {
  if (eyes.length < 2) return [];
  const now = v.tw / 60_000; const w = Math.floor(now / WINDOW);
  const out: Bubble[] = [];
  let localtime: string | null = null;
  try { localtime = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date()); } catch { localtime = null; }
  for (const p of PLACES_GEO) {
    const ax = p.anchor.x * TILE, ay = p.anchor.y * TILE;
    const n = eyes.filter((e) => Math.abs(e.x - ax) < 12 * TILE && Math.abs(e.y - ay) < 9 * TILE).length;
    if (n < 2) continue;
    const here = v.poses.filter((q) => q.place === p.id && !q.moving && !q.dying).map((q) => q.uid).sort((a, b) => a - b);
    if (!here.length) continue;
    const k = key(CH.EYES, p.id, w);
    if (k % 100 >= 25 + n * 5) continue;
    const uid = here[(k >>> 8) % here.length];
    const start = w * WINDOW + 0.5; const age = (now - start) / 3;
    if (age < 0 || age >= 1) continue;
    out.push({ uid, text: eyesLine(v.cur, uid, p.id, n, w, localtime), color: v.profiles.get(uid)?.color ?? '#9ca3af', age, major: 1 });
  }
  return out;
}
