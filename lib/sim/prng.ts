// Deterministic randomness. No global state: every draw is derived from a key.
import { WORLD_SEED } from './config';

/** murmur3 finalizer — 32-bit avalanche. */
export function mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function fold(h: number, v: number): number {
  return mix(((h ^ Math.imul(v | 0, 0x9e3779b1)) + 0x7f4a7c15) | 0);
}

/** Stable key from up to five integers (seeded by the world seed). */
export function key(a: number, b = 0, c = 0, d = 0, e = 0): number {
  let h = fold(WORLD_SEED, a);
  h = fold(h, b);
  h = fold(h, c);
  h = fold(h, d);
  return fold(h, e);
}

/** Channels keep independent random streams from colliding. */
export const CH = {
  MARKET: 1, STORY: 2, ORDER: 3, VOTE: 4, SCHED: 5, BIRTH: 6, LINE: 7,
  WEATHER: 8, CHAT: 9, DEPART: 10, WANDER: 11, NAME: 12, INIT: 13, OFFSET: 14,
  GLITCH: 15, EYES: 16,
} as const;

/** sfc32 — small fast counter PRNG, 32-bit integer only. */
export class Rng {
  private a: number; private b: number; private c: number; private d: number;
  constructor(seed: number) {
    this.a = seed | 0;
    this.b = mix(seed ^ 0xdeadbeef) | 0;
    this.c = mix(seed + 0x1234567) | 0;
    this.d = 1;
    for (let i = 0; i < 12; i++) this.next();
  }
  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }
  /** Integer in [0, n). */
  int(n: number): number { return n <= 0 ? 0 : this.next() % n; }
  /** Integer in [lo, hi]. */
  range(lo: number, hi: number): number { return lo + this.int(hi - lo + 1); }
  /** true with probability p / 10 000. */
  chance(p: number): boolean { return this.next() % 10000 < p; }
  pick<T>(arr: readonly T[]): T { return arr[this.int(arr.length)]; }
  /** Weighted pick; weights are non-negative integers. Returns -1 if all zero. */
  pickW(items: readonly number[], weights: readonly number[]): number {
    let total = 0;
    for (let i = 0; i < weights.length; i++) total += weights[i] > 0 ? weights[i] : 0;
    if (total <= 0) return -1;
    let r = this.int(total);
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] > 0 ? weights[i] : 0;
      if (r < w) return items[i];
      r -= w;
    }
    return -1;
  }
}

export function rngFor(a: number, b = 0, c = 0, d = 0, e = 0): Rng {
  return new Rng(key(a, b, c, d, e));
}
