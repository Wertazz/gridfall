// Client world engine: time → state → poses → frame. React only reads snapshots.
import { GENESIS_MS, WORLD_RATIO, ORACLE_MS } from '../sim/config';
import { stateHash, type WorldState } from '../sim/state';
import { allPoses, type Pose } from '../micro/positions';
import { profileFrom, type Profile } from '../sim/profile';
import { isRaining } from '../sim/storylets';
import { StateStore } from './store';
import { Renderer, type Bubble, type Eye } from '../render/renderer';

export type TimeMode = { kind: 'live' } | { kind: 'fixed'; t: number; at?: number } | { kind: 'oracle'; ahead: number };

export type View = {
  tMs: number; tw: number; minute: number; H: number; minuteOfDay: number; day: number;
  prev: WorldState; cur: WorldState; hash: string; poses: Pose[]; profiles: Map<number, Profile>;
};

export function worldMs(tMs: number) { return (tMs - GENESIS_MS) * WORLD_RATIO; }

export class WorldEngine {
  store = new StateStore();
  renderer: Renderer | null = null;
  mode: TimeMode = { kind: 'live' };
  selected = -1;
  follow = false;
  /** performance.now() of the last user camera gesture; the auto-director waits 20 s after it. */
  lastInteract = -1e9;
  private dirTarget: { x: number; y: number } | null = null;
  private dirAt = -1e9;
  private framed = false;
  eyes: Eye[] = [];
  bubbleSource: ((v: View) => Bubble[]) | null = null;
  font = '"Courier New", monospace';
  private raf = 0;
  private last: View | null = null;
  private hashCache = new Map<number, string>();
  private profCache: { key: string; map: Map<number, Profile> } | null = null;
  private listeners = new Set<(v: View) => void>();
  private lastEmit = 0;

  timeNow(): number {
    const now = Date.now();
    if (this.mode.kind === 'fixed') return this.mode.t + (now - (this.mode.at ?? now));
    if (this.mode.kind === 'oracle') return now + Math.min(ORACLE_MS, Math.max(0, this.mode.ahead));
    return now;
  }

  view(tMs = this.timeNow()): View | null {
    const tw = Math.max(0, worldMs(tMs));
    const minute = Math.floor(tw / 60_000);
    const H = Math.floor(minute / 60);
    const prev = this.store.get(H); const cur = this.store.get(H + 1);
    if (!prev || !cur) return this.last;
    let hash = this.hashCache.get(cur.hour);
    if (!hash) { hash = stateHash(cur); this.hashCache.set(cur.hour, hash); if (this.hashCache.size > 64) this.hashCache.delete(this.hashCache.keys().next().value as number); }
    const pkey = `${prev.hour}|${cur.hour}|${hash}`;
    let profiles: Map<number, Profile>;
    if (this.profCache && this.profCache.key === pkey) profiles = this.profCache.map;
    else {
      profiles = new Map<number, Profile>();
      for (const a of prev.agents) if (a.uid >= 0) profiles.set(a.uid, profileFrom(a, a.alive === 1));
      for (const a of cur.agents) if (a.uid >= 0) profiles.set(a.uid, profileFrom(a, a.alive === 1));
      this.profCache = { key: pkey, map: profiles };
    }
    const v: View = { tMs, tw, minute, H, minuteOfDay: minute % 1440, day: Math.floor(minute / 1440), prev, cur, hash, poses: allPoses(prev, cur, tw), profiles };
    this.last = v;
    return v;
  }

  /** Auto-director: when nobody touches the camera, glide to where something is happening. */
  private direct(v: View) {
    const R = this.renderer; if (!R || this.follow) return;
    const now = performance.now();
    if (now - this.lastInteract < 20_000) return;
    if (now - this.dirAt > 5000 || !this.dirTarget) { this.dirAt = now; this.dirTarget = this.pickTarget(v); }
    const t = this.dirTarget; if (!t) return;
    const cam = R.cam;
    if (!this.framed) { cam.x = t.x; cam.y = t.y; this.framed = true; }
    else { cam.x += (t.x - cam.x) * 0.02; cam.y += (t.y - cam.y) * 0.02; }
    cam.clamp(R.w, R.h);
  }

  private pickTarget(v: View): { x: number; y: number } | null {
    const pos = new Map(v.poses.map((p) => [p.uid, p]));
    for (let k = v.cur.log.length - 1; k >= 0; k--) {
      const e = v.cur.log[k]; const start = e.hour * 60 + e.minute;
      if (start > v.minute) continue;
      if (v.minute - start > 25) break;
      const p = pos.get(e.a) ?? pos.get(e.b);
      if (p && e.sid >= 0 && (e.a >= 0 || e.b >= 0)) return { x: p.x / 16, y: p.y / 16 - 10 };
    }
    const groups = new Map<number, { n: number; x: number; y: number }>();
    for (const p of v.poses) { const g = groups.get(p.place) ?? { n: 0, x: 0, y: 0 }; g.n++; g.x += p.x / 16; g.y += p.y / 16; groups.set(p.place, g); }
    let best: { n: number; x: number; y: number } | null = null;
    groups.forEach((g) => { if (!best || g.n > best.n) best = g; });
    const b = best as { n: number; x: number; y: number } | null;
    return b ? { x: b.x / b.n, y: b.y / b.n - 10 } : null;
  }

  subscribe(fn: (v: View) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }

  async start(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    await this.store.init(Math.floor(worldMs(this.timeNow()) / 3_600_000));
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const v = this.view(); if (!v || !this.renderer) return;
      this.direct(v);
      if (this.follow && this.selected >= 0) {
        const p = v.poses.find((q) => q.uid === this.selected);
        if (p) { const cam = this.renderer.cam; cam.x += (p.x / 16 - cam.x) * 0.12; cam.y += (p.y / 16 - 8 - cam.y) * 0.12; cam.clamp(this.renderer.w, this.renderer.h); }
      }
      this.renderer.draw({
        tw: v.tw, H: v.H, minuteOfDay: v.minuteOfDay, cur: v.cur, poses: v.poses, profiles: v.profiles,
        bubbles: this.bubbleSource ? this.bubbleSource(v) : [], eyes: this.eyes, selected: this.selected,
        raining: isRaining(v.H), oracle: this.mode.kind === 'oracle' ? 2 : 0, font: this.font,
      });
      const now = performance.now();
      if (now - this.lastEmit > 250) { this.lastEmit = now; this.listeners.forEach((l) => l(v)); }
    };
    loop();
  }

  stop() { cancelAnimationFrame(this.raf); }
}
