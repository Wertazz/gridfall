import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The fourth wall is cosmetic: presence code must never be able to write to the world.
describe('observers never touch the world', () => {
  for (const f of ['lib/world/presence.ts', 'lib/lines/fourth-wall.ts']) {
    it(`${f} imports nothing that mutates the simulation`, () => {
      const src = readFileSync(f, 'utf8');
      expect(src).not.toMatch(/sim\/(step|ctx|storylets)/);
      expect(src).not.toMatch(/stepHour|replay\(|\.rel\[|\.money\s*=|\.mood\s*=/);
    });
  }
});
