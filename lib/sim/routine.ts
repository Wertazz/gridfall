// Where is an agent supposed to be at a given world hour? Pure function of state.
import { N_MAX } from './config';
import { P, ROUTINES, ROLES, R, T, S, L, F } from './roster';
import { ARC, type WorldState } from './state';

export function dayOf(h: number): number { return Math.floor(h / 24); }
export function hourOfDay(h: number): number { return ((h % 24) + 24) % 24; }
export function weekDay(h: number): number { return dayOf(h) % 7; }

export function slotOfUid(s: WorldState, uid: number): number {
  if (uid < 0) return -1;
  for (let i = 0; i < s.agents.length; i++) if (s.agents[i].uid === uid && s.agents[i].alive) return i;
  return -1;
}

export function isNight(hod: number): boolean { return hod >= 22 || hod <= 4; }

export function placeOf(s: WorldState, slot: number, h: number): number {
  const a = s.agents[slot];
  if (!a || !a.alive) return -1;
  const hod = hourOfDay(h);
  const wd = weekDay(h);

  if (a.override >= 0 && a.overrideUntil > h) return a.override;
  if (a.energy <= 3) return P.STACKS;

  // Election day: everyone walks to Eden Hall to vote.
  if (wd === 6 && hod === 17 && s.politics.candidates.length > 0) return P.EDEN;
  // Debate night: candidates on stage, the curious watch.
  if (wd === 5 && hod >= 19 && hod <= 21 && s.politics.candidates.indexOf(a.uid) >= 0) return P.EDEN;

  for (let k = 0; k < s.arcs.length; k++) {
    const arc = s.arcs[k];
    if (arc.type === ARC.STRIKE && hod >= 9 && hod <= 17) {
      const leader = slotOfUid(s, arc.a);
      if (a.uid === arc.a) return P.UNION;
      if (leader >= 0 && a.uid !== arc.b && (a.faction === F.EDEN || s.rel[slot * N_MAX + leader] > 30)) return P.UNION;
    }
    if (arc.type === ARC.AFFAIR && hod === 23 && (arc.a === a.uid || arc.b === a.uid)) return P.ALLEY;
    if (arc.type === ARC.BANKRUN && h - arc.start < 6 && hod >= 8 && hod <= 20 && a.money > 50000 && ((a.uid + arc.start) % 3 === 0)) return P.VAULT;
  }

  const cultist = a.faction === F.NYX || (a.secrets & S.CULT) !== 0;
  const curfew = (s.politics.laws & L.CURFEW) !== 0;
  if (cultist && (hod >= 22 || hod <= 2)) {
    if (!curfew || (a.traits & T.ZEALOT)) return P.NYX;
    return P.STACKS;
  }

  let p = ROUTINES[ROLES[a.role].routine][hod];
  if (p === -1) p = a.work;
  if (curfew && (hod >= 22 || hod <= 4) && (p === P.NYX || p === P.ALLEY || p === P.NOODLE) && !(a.traits & T.ZEALOT)) return P.STACKS;
  // Union leaders and politicians drift to the Square on weekend afternoons.
  if (wd === 3 && hod >= 14 && hod <= 17 && (a.role === R['Union Leader'] || a.faction === F.EDEN)) return P.UNION;
  return p;
}
