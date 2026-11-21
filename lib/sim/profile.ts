// Display identity of an agent (founder or newborn), from its uid. Pure.
import { FOUNDERS, ROLES, FACTION_NAMES, BORN_COLORS, bornName, TRAIT_NAMES } from './roster';
import { mix } from './prng';
import type { WorldState, Agent, Grave } from './state';

export type Profile = {
  uid: number; name: string; handle: string; role: string; tag: string; color: string;
  faction: string; shape: number; skin: number; founder: boolean; alive: boolean;
};

const unknown: Profile = { uid: -1, name: 'SYSTEM', handle: 'system', role: 'System', tag: 'SYS', color: '#6b7280', faction: '—', shape: 7, skin: 4, founder: false, alive: true };

export function profileFrom(a: Pick<Agent, 'uid' | 'origin' | 'role' | 'faction' | 'color'>, alive: boolean): Profile {
  if (a.origin >= 0) {
    const f = FOUNDERS[a.origin];
    return { uid: a.uid, name: f.name, handle: f.handle, role: ROLES[a.role].name, tag: ROLES[a.role].tag, color: f.color, faction: FACTION_NAMES[a.faction], shape: ROLES[a.role].shape, skin: mix(a.uid + 11) % 5, founder: true, alive };
  }
  const n = bornName(a.uid);
  return { uid: a.uid, name: n.name, handle: n.handle, role: ROLES[a.role].name, tag: ROLES[a.role].tag, color: BORN_COLORS[a.color % BORN_COLORS.length], faction: FACTION_NAMES[a.faction], shape: ROLES[a.role].shape, skin: mix(a.uid + 11) % 5, founder: false, alive };
}

export function profileOf(s: WorldState, uid: number): Profile {
  if (uid < 0) return unknown;
  for (const a of s.agents) if (a.uid === uid) return profileFrom(a, a.alive === 1);
  for (const g of s.graves) if (g.uid === uid) return profileFrom(g, false);
  // Older dead agents (graves rotated out): founders are still known.
  if (uid < FOUNDERS.length) return profileFrom({ uid, origin: uid, role: FOUNDERS[uid].role, faction: FOUNDERS[uid].faction, color: 0 }, false);
  const n = bornName(uid);
  return { ...unknown, uid, name: n.name, handle: n.handle, role: 'Citizen', tag: '—', alive: false };
}

export function graveProfile(g: Grave): Profile { return profileFrom(g, false); }

export function traitList(traits: number): string[] {
  const out: string[] = [];
  for (let b = 0; b < TRAIT_NAMES.length; b++) if (traits & (1 << b)) out.push(TRAIT_NAMES[b]);
  return out;
}

export { unknown as SYSTEM_PROFILE };
