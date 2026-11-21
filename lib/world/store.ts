// Client-side state access: checkpoint + bounded replay, with a small snapshot cache.
import { CHECKPOINT_HOURS } from '../sim/config';
import { genesisState, stepHour } from '../sim/step';
import { cloneState, deserialize, type WorldState } from '../sim/state';
import { simFingerprint } from '../sim/fingerprint';

type Index = { count: number; every: number; genesis: number; version: number; fingerprint?: string };
const SYNC_REPLAY_LIMIT = 2 * CHECKPOINT_HOURS + 48;
const CACHE_MAX = 72;

export class StateStore {
  private index: Index | null = null;
  private cursor: WorldState | null = null;
  private snaps = new Map<number, WorldState>();
  private seeking: number | null = null;
  ready = false;

  constructor(private base = '/checkpoints') {}

  async init(targetHour: number) {
    try {
      const r = await fetch(`${this.base}/index.json`, { cache: 'no-cache' });
      if (r.ok) this.index = await r.json();
    } catch { this.index = null; }
    // Checkpoints computed by another version of the simulation are useless: ignore them.
    if (this.index && this.index.fingerprint !== simFingerprint()) this.index = null;
    await this.seek(targetHour);
    this.ready = true;
  }

  private async loadCheckpoint(k: number): Promise<WorldState | null> {
    if (k <= 0 || !this.index || k >= this.index.count) return null;
    try {
      const r = await fetch(`${this.base}/${k}.bin?v=${this.index.fingerprint}`, { cache: 'force-cache' });
      if (!r.ok) return null;
      const buf = await r.arrayBuffer();
      const dv = new DataView(buf);
      const words = new Int32Array(buf.byteLength / 4);
      for (let i = 0; i < words.length; i++) words[i] = dv.getInt32(i * 4, true);
      return deserialize(words);
    } catch { return null; }
  }

  /** Make `hour` reachable synchronously (loads the right checkpoint). */
  async seek(hour: number) {
    if (this.seeking === hour) return;
    this.seeking = hour;
    const maxK = this.index ? this.index.count - 1 : 0;
    let k = Math.min(Math.floor(Math.max(0, hour) / CHECKPOINT_HOURS), maxK);
    let s: WorldState | null = null;
    while (k > 0 && !s) { s = await this.loadCheckpoint(k); if (!s) k--; }
    if (!s) s = genesisState();
    // Keep the current cursor if it is already a better starting point.
    if (!this.cursor || this.cursor.hour > hour || s.hour > this.cursor.hour) this.cursor = s;
    this.seeking = null;
  }

  private remember(s: WorldState) {
    this.snaps.set(s.hour, cloneState(s));
    if (this.snaps.size > CACHE_MAX) { const first = this.snaps.keys().next().value as number; this.snaps.delete(first); }
  }

  /** State with s.hour === hour, or null if it needs an async seek first. */
  get(hour: number): WorldState | null {
    if (hour < 0) hour = 0;
    const hit = this.snaps.get(hour); if (hit) return hit;
    const c = this.cursor;
    if (!c) return null;
    if (c.hour <= hour && hour - c.hour <= SYNC_REPLAY_LIMIT) {
      while (c.hour < hour) { stepHour(c); if (hour - c.hour <= 4) this.remember(c); }
      this.remember(c);
      return this.snaps.get(hour) ?? null;
    }
    void this.seek(hour);
    return null;
  }

  /** Warm a range ahead of time (oracle / scrubbing). */
  hasIndex() { return this.index !== null; }
}
