import { describe, it, expect } from 'vitest';
import { genesisState, stepHour, replay } from '../lib/sim/step';
import { serialize, deserialize, stateHash, cloneState } from '../lib/sim/state';
import { Rng } from '../lib/sim/prng';
import { placeOf } from '../lib/sim/routine';
import { N_MAX, MIN_ALIVE, CHECKPOINT_HOURS } from '../lib/sim/config';

const YEAR = 365 * 24;

describe('determinism', () => {
  it('same T gives the same hash on 1 000 random T', () => {
    const r = new Rng(42);
    const ts = Array.from({ length: 1000 }, () => r.int(YEAR)).sort((a, b) => a - b);
    const run = () => { const s = genesisState(); return ts.map((t) => stateHash(replay(s, t))); };
    expect(run()).toEqual(run());
  });

  it('checkpoint + replay equals full replay', () => {
    const full = genesisState();
    const cps: Int32Array[] = [];
    for (let k = 1; k <= 30; k++) { replay(full, k * CHECKPOINT_HOURS); cps.push(serialize(full)); }
    const target = 30 * CHECKPOINT_HOURS + 137;
    const ref = stateHash(replay(cloneState(full), target));
    for (const k of [0, 7, 19, 29]) {
      const s = deserialize(cps[k]);
      expect(stateHash(replay(s, target))).toBe(ref);
    }
  });

  it('serialize/deserialize round-trips exactly', () => {
    const s = replay(genesisState(), 500);
    const back = deserialize(serialize(s));
    expect(stateHash(back)).toBe(stateHash(s));
    stepHour(s); stepHour(back);
    expect(stateHash(back)).toBe(stateHash(s));
  });
});

describe('performance', () => {
  it('one world year simulates under 1.5 s', () => {
    const t0 = performance.now();
    replay(genesisState(), YEAR);
    expect(performance.now() - t0).toBeLessThan(1500);
  });
  it('a checkpoint gap (288 h) replays under 40 ms', () => {
    const s = replay(genesisState(), 2000);
    const t0 = performance.now();
    replay(s, 2000 + CHECKPOINT_HOURS);
    expect(performance.now() - t0).toBeLessThan(40);
  });
});

describe('invariants over one world year (≈ 30 real days)', () => {
  it('no absurd state', () => {
    const s = genesisState();
    let elections = 0;
    for (let h = 0; h < YEAR; h++) {
      const before = s.politics.elections;
      stepHour(s);
      const alive = s.agents.filter((a) => a.alive);
      expect(alive.length).toBeGreaterThanOrEqual(MIN_ALIVE);
      expect(alive.length).toBeLessThanOrEqual(N_MAX);
      for (const a of alive) {
        expect(a.money).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(a.money)).toBe(true);
        expect(a.mood).toBeGreaterThanOrEqual(-100); expect(a.mood).toBeLessThanOrEqual(100);
        expect(a.energy).toBeGreaterThanOrEqual(0); expect(a.energy).toBeLessThanOrEqual(100);
      }
      for (const t of s.tokens) expect(t.price).toBeGreaterThan(0);
      const uids = alive.map((a) => a.uid);
      expect(new Set(uids).size).toBe(uids.length);
      if (s.politics.president >= 0) expect(uids).toContain(s.politics.president);
      for (let i = 0; i < s.agents.length; i++) if (s.agents[i].alive) expect(placeOf(s, i, s.hour)).toBeGreaterThanOrEqual(0);
      if (s.politics.elections > before) elections++;
    }
    expect(elections).toBeGreaterThanOrEqual(50); // one every 7 world days, never skipped
  });
});
