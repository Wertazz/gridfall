import { describe, it, expect } from 'vitest';
import { genesisState, stepHour } from '../lib/sim/step';
import { cloneState, type WorldState } from '../lib/sim/state';
import { allPoses, UNIT } from '../lib/micro/positions';
import { walkable, GRID, MAP_W, TL } from '../lib/micro/map';
import { paths } from '../lib/micro/path';
import { PLACE_COUNT } from '../lib/sim/roster';

describe('micro-sim', () => {
  it('every place is reachable from every other place', () => {
    const P = paths();
    for (let a = 0; a < PLACE_COUNT; a++) for (let b = 0; b < PLACE_COUNT; b++) expect(P[a][b].length).toBeGreaterThan(0);
  });

  it('poses are deterministic and never inside walls (3 world days, every 2 world minutes)', () => {
    const run = () => {
      const s = genesisState(); const out: string[] = [];
      let prev: WorldState = cloneState(s);
      stepHour(s);
      for (let H = 0; H < 72; H++) {
        const cur = cloneState(s);
        for (let m = 0; m < 60; m += 2) {
          const tw = (H * 60 + m) * 60_000 + 1234;
          const poses = allPoses(prev, cur, tw);
          for (const p of poses) {
            const tx = Math.floor(p.x / UNIT), ty = Math.floor(p.y / UNIT);
            const t = GRID[ty * MAP_W + tx];
            const ok = walkable(tx, ty) || t === TL.DOOR;
            if (!ok) throw new Error(`agent ${p.uid} in blocked tile ${tx},${ty} (type ${t}) at H=${H} m=${m}`);
            out.push(`${p.uid}:${p.x},${p.y}`);
          }
        }
        prev = cur; stepHour(s);
      }
      return out.join('|');
    };
    const a = run(); const b = run();
    expect(a.length).toBeGreaterThan(1000);
    expect(a).toBe(b);
  });
});
