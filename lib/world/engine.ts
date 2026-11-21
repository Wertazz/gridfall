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
  eyes: Eye[] = [];
  bubbleSource: ((v: View) => Bubble[]) | null = null;
  font = '"Courier New", monospace';
  private raf = 0;
  private last: View | null = null;
  private hashCache = new Map<number, string>();
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
    const profiles = new Map<number, Profile>();
    for (const a of prev.agents) if (a.uid >= 0) profiles.set(a.uid, profileFrom(a, a.alive === 1));
    for (const a of cur.agents) if (a.uid >= 0) profiles.set(a.uid, profileFrom(a, a.alive === 1));
    const v: View = { tMs, tw, minute, H, minuteOfDay: minute % 1440, day: Math.floor(minute / 1440), prev, cur, hash, poses: allPoses(prev, cur, tw), profiles };
    this.last = v;
    return v;
  }

  subscribe(fn: (v: View) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }

  async start(canvas: HTMLCanvasElement) {
    this.renderer = new Renderer(canvas);
    await this.store.init(Math.floor(worldMs(this.timeNow()) / 3_600_000));
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const v = this.view(); if (!v || !this.renderer) return;
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
