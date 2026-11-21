import { describe, it, expect } from 'vitest';
import { genesisState, stepHour } from '../lib/sim/step';
import { placeOf, hourOfDay } from '../lib/sim/routine';
import { STORYLETS } from '../lib/sim/storylets';
import { L, F, S, T, P } from '../lib/sim/roster';

const YEARS2 = 2 * 365 * 24;

describe('politics changes the rules', () => {
  it('elections always produce a living president, laws come and go, curfew and press ban bite', () => {
    const s = genesisState();
    let lastSeq = 0, elections = 0, curfewChecked = 0, pressBanHours = 0, lawsSeen = 0;
    const id = (sid: number) => STORYLETS[sid].id;
    for (let h = 0; h < YEARS2; h++) {
      const pressBan = (s.politics.laws & L.PRESS_BAN) !== 0;
      stepHour(s);
      for (const e of s.log) {
        if (e.seq < lastSeq) continue;
        if (id(e.sid) === 'election_result') {
          elections++;
          expect(s.agents.some((a) => a.alive && a.uid === e.a)).toBe(true);
        }
        if (id(e.sid) === 'law_promulgated') lawsSeen |= e.p0;
        if (pressBan && (id(e.sid) === 'leak_drop' || id(e.sid) === 'investigation_published')) throw new Error('press ban ignored');
      }
      lastSeq = s.seq;
      if (pressBan) pressBanHours++;
      if ((s.politics.laws & L.CURFEW) && hourOfDay(s.hour) === 23) {
        for (let i = 0; i < s.agents.length; i++) {
          const a = s.agents[i];
          if (!a.alive || a.override >= 0 && a.overrideUntil > s.hour) continue;
          const cultist = a.faction === F.NYX || (a.secrets & S.CULT) !== 0;
          if (cultist && !(a.traits & T.ZEALOT) && a.energy > 3) { expect(placeOf(s, i, s.hour)).toBe(P.STACKS); curfewChecked++; }
        }
      }
    }
    expect(elections).toBeGreaterThanOrEqual(100);
    expect(lawsSeen & (L.CURFEW | L.TX_TAX | L.UBI)).toBeGreaterThan(0);
    // These run on emergent conditions; over two world years at least one must have happened.
    expect(curfewChecked + pressBanHours).toBeGreaterThan(0);
  });
});
