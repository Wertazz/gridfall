// Static world data: places, roles, factions, founding agents, procedural names.
import { AGENTS } from '../agents.config';
import { CH, key, mix } from './prng';

// ── Places ──────────────────────────────────────────────────────────────────
export const P = {
  STACKS: 0, NOVA: 1, APEX: 2, VAULT: 3, WIRE: 4, UNION: 5, EDEN: 6, EXCHANGE: 7,
  NYX: 8, ALLEY: 9, ORACLE: 10, CEMETERY: 11, RUINS: 12, NOODLE: 13,
} as const;
export const PLACE_COUNT = 14;
export const PLACE_NAMES = [
  'The Stacks', 'Nova Tower', 'Apex Spire', 'Vault Bank', 'The Wire', 'Union Square',
  'Eden Hall', 'The Exchange', 'Nyx Basement', 'Ghost Alley', 'The Oracle', 'Cemetery',
  'Ruins of Season 1', 'Neon Noodle',
];

// ── Factions ────────────────────────────────────────────────────────────────
export const F = { INDEPENDENT: 0, NOVACORP: 1, EDEN: 2, NYX: 3, APEXCORP: 4 } as const;
export const FACTION_NAMES = ['Independent', 'NovaCorp', 'Eden Revolution', 'Nyx Cult', 'ApexCorp'];
export const FACTION_COLORS = ['#9ca3af', '#c084fc', '#34d399', '#f472b6', '#f43f5e'];

// ── Traits (bitmask) ────────────────────────────────────────────────────────
export const T = {
  AMBITIOUS: 1, GREEDY: 2, LOYAL: 4, PARANOID: 8, ROMANTIC: 16, ZEALOT: 32,
  HONEST: 64, VOLATILE: 128, CHARISMATIC: 256, RECLUSIVE: 512,
} as const;
export const TRAIT_NAMES = [
  'ambitious', 'greedy', 'loyal', 'paranoid', 'romantic', 'zealot', 'honest', 'volatile',
  'charismatic', 'reclusive',
];

// ── Secrets (bitmask) ───────────────────────────────────────────────────────
export const S = {
  EMBEZZLE: 1, AFFAIR: 2, INSIDER: 4, DEBT: 8, FAKE_ID: 16, BRIBE: 32, CULT: 64, HACKED: 128,
} as const;
export const SECRET_NAMES = [
  'embezzled company funds', 'is having a secret affair', 'trades on insider information',
  'is drowning in hidden debt', 'is not who they claim to be', 'bought votes',
  'is a secret member of the Nyx Cult', 'holds stolen data',
];

// ── Routines (24 hourly place slots) ───────────────────────────────────────
// W = the agent's own workplace (resolved per agent).
const W = -1;
const s = P.STACKS, n = P.NOODLE;
export const ROUTINES: Record<string, number[]> = {
  //       0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
  corp:   [s, s, s, s, s, s, s, s, W, W, W, W, n, W, W, W, W, W, W, P.EXCHANGE, P.EXCHANGE, n, s, s],
  media:  [s, s, s, s, s, s, s, s, s, P.WIRE, P.WIRE, P.WIRE, P.WIRE, n, P.ALLEY, P.ALLEY, P.WIRE, P.WIRE, P.WIRE, P.WIRE, n, n, n, s],
  trader: [s, s, s, s, s, s, s, P.EXCHANGE, P.EXCHANGE, P.EXCHANGE, P.EXCHANGE, P.EXCHANGE, n, P.EXCHANGE, P.EXCHANGE, P.EXCHANGE, P.EXCHANGE, P.EXCHANGE, n, n, n, n, s, s],
  politic:[s, s, s, s, s, s, s, s, s, P.EDEN, P.EDEN, P.EDEN, n, P.EDEN, P.EDEN, P.EDEN, P.EDEN, P.UNION, P.UNION, n, n, n, s, s],
  mystic: [P.NYX, P.NYX, P.NYX, P.NYX, s, s, s, s, s, s, s, s, s, s, s, P.RUINS, P.RUINS, P.CEMETERY, P.ORACLE, n, n, P.NYX, P.NYX, P.NYX],
  shadow: [P.ALLEY, P.ALLEY, s, s, s, s, s, s, s, s, s, s, s, s, P.ALLEY, P.ALLEY, P.ALLEY, P.ALLEY, P.RUINS, P.RUINS, P.RUINS, P.ALLEY, P.ALLEY, P.ALLEY],
  oracle: [s, s, s, s, s, s, P.ORACLE, P.ORACLE, P.ORACLE, P.ORACLE, P.ORACLE, P.ORACLE, P.ORACLE, P.ORACLE, P.ORACLE, P.ORACLE, P.CEMETERY, P.ORACLE, P.ORACLE, P.ORACLE, P.ORACLE, P.ORACLE, s, s],
  bank:   [s, s, s, s, s, s, s, s, P.VAULT, P.VAULT, P.VAULT, P.VAULT, P.VAULT, n, P.VAULT, P.VAULT, P.VAULT, P.VAULT, P.EXCHANGE, P.EXCHANGE, s, s, s, s],
  tech:   [s, s, s, s, s, s, s, s, s, s, s, s, s, P.VAULT, P.VAULT, P.EXCHANGE, n, s, s, s, s, s, s, s],
  union:  [s, s, s, s, s, s, s, s, P.UNION, P.UNION, P.UNION, P.UNION, P.EXCHANGE, P.EXCHANGE, P.UNION, P.UNION, P.UNION, P.UNION, n, n, n, n, s, s],
  philo:  [s, s, s, s, s, s, s, s, P.RUINS, P.RUINS, P.RUINS, P.CEMETERY, P.CEMETERY, P.ORACLE, P.ORACLE, P.ORACLE, P.UNION, P.UNION, n, n, n, s, s, s],
  pop:    [n, s, s, s, s, s, s, s, s, s, s, n, n, n, P.EXCHANGE, P.EXCHANGE, P.UNION, P.UNION, P.EDEN, P.EDEN, n, n, n, n],
};

// ── Roles ───────────────────────────────────────────────────────────────────
export type RoleDef = { name: string; tag: string; routine: string; income: number; shape: number };
// shape: sprite silhouette id (see lib/render/sprites.ts)
export const ROLES: RoleDef[] = [
  { name: 'CEO',           tag: 'CEO',    routine: 'corp',    income: 30000, shape: 0 },
  { name: 'Journalist',    tag: 'PRESS',  routine: 'media',   income: 9000,  shape: 1 },
  { name: 'Oracle',        tag: 'ORACLE', routine: 'oracle',  income: 6000,  shape: 2 },
  { name: 'Broker',        tag: 'BROKER', routine: 'trader',  income: 7000,  shape: 3 },
  { name: 'Ghost',         tag: 'GHOST',  routine: 'shadow',  income: 5000,  shape: 4 },
  { name: 'Politician',    tag: 'POLIT.', routine: 'politic', income: 9000,  shape: 5 },
  { name: 'Hacker',        tag: 'HACKER', routine: 'shadow',  income: 8000,  shape: 6 },
  { name: 'Banker',        tag: 'BANK',   routine: 'bank',    income: 32000, shape: 0 },
  { name: 'Strategist',    tag: 'STRAT.', routine: 'corp',    income: 14000, shape: 7 },
  { name: 'DAO Leader',    tag: 'DAO',    routine: 'politic', income: 7000,  shape: 5 },
  { name: 'Mystic',        tag: 'MYSTIC', routine: 'mystic',  income: 6000,  shape: 2 },
  { name: 'Rival CEO',     tag: 'CEO',    routine: 'corp',    income: 28000, shape: 0 },
  { name: 'Whistleblower', tag: 'LEAK',   routine: 'shadow',  income: 3000,  shape: 4 },
  { name: 'Philosopher',   tag: 'PHILO',  routine: 'philo',   income: 4000,  shape: 2 },
  { name: 'Engineer',      tag: 'ENG.',   routine: 'tech',    income: 12000, shape: 6 },
  { name: 'Influencer',    tag: 'INFLNC', routine: 'pop',     income: 10000, shape: 8 },
  { name: 'Anarchist',     tag: 'ANARCH', routine: 'shadow',  income: 3000,  shape: 9 },
  { name: 'Data Analyst',  tag: 'DATA',   routine: 'tech',    income: 11000, shape: 7 },
  { name: 'Union Leader',  tag: 'UNION',  routine: 'union',   income: 6000,  shape: 5 },
];
export const R: Record<string, number> = Object.fromEntries(ROLES.map((r, i) => [r.name, i]));
/** Roles a newborn agent can take. */
export const BORN_ROLES = [
  R['Journalist'], R['Broker'], R['Hacker'], R['Politician'], R['Mystic'], R['Philosopher'],
  R['Engineer'], R['Influencer'], R['Anarchist'], R['Data Analyst'], R['Union Leader'], R['Strategist'],
];

// ── Founding agents (from lib/agents.config.ts, SYSTEM excluded) ───────────
export type Founder = {
  name: string; handle: string; role: number; color: string; faction: number;
  traits: number; secrets: number; money: number; work: number; personality: string; style: string;
};

const FOUNDER_EXTRA: Record<string, { traits: number; secrets: number; work: number }> = {
  nova_corp:   { traits: T.AMBITIOUS | T.GREEDY | T.CHARISMATIC, secrets: S.EMBEZZLE | S.INSIDER, work: P.NOVA },
  m4rcus:      { traits: T.HONEST | T.PARANOID, secrets: 0, work: P.WIRE },
  luna_v:      { traits: T.RECLUSIVE | T.HONEST, secrets: 0, work: P.ORACLE },
  ethan_fx:    { traits: T.GREEDY | T.VOLATILE, secrets: S.DEBT, work: P.EXCHANGE },
  zer0_x:      { traits: T.RECLUSIVE | T.PARANOID, secrets: S.FAKE_ID, work: P.ALLEY },
  eden_rise:   { traits: T.AMBITIOUS | T.CHARISMATIC | T.HONEST, secrets: 0, work: P.EDEN },
  c1pher:      { traits: T.GREEDY | T.PARANOID, secrets: S.HACKED, work: P.ALLEY },
  aria_media:  { traits: T.AMBITIOUS | T.HONEST, secrets: 0, work: P.WIRE },
  vault_bank:  { traits: T.GREEDY | T.LOYAL, secrets: S.INSIDER, work: P.VAULT },
  rook_strat:  { traits: T.AMBITIOUS | T.PARANOID, secrets: S.BRIBE, work: P.NOVA },
  flux_dao:    { traits: T.ZEALOT | T.CHARISMATIC, secrets: 0, work: P.EDEN },
  nyx_cult:    { traits: T.ZEALOT | T.RECLUSIVE | T.CHARISMATIC, secrets: 0, work: P.NYX },
  apex_corp:   { traits: T.AMBITIOUS | T.GREEDY, secrets: S.BRIBE, work: P.APEX },
  gh0st_net:   { traits: T.HONEST | T.RECLUSIVE | T.PARANOID, secrets: S.FAKE_ID, work: P.ALLEY },
  sol_prophet: { traits: T.ROMANTIC | T.HONEST, secrets: 0, work: P.RUINS },
  byte_dev:    { traits: T.LOYAL | T.RECLUSIVE, secrets: 0, work: P.VAULT },
  mira_pop:    { traits: T.VOLATILE | T.ROMANTIC | T.CHARISMATIC, secrets: S.DEBT | S.CULT, work: P.NOODLE },
  drift_x:     { traits: T.VOLATILE | T.ZEALOT, secrets: 0, work: P.ALLEY },
  iris_data:   { traits: T.HONEST | T.RECLUSIVE, secrets: 0, work: P.EXCHANGE },
  kira_union:  { traits: T.ZEALOT | T.LOYAL | T.CHARISMATIC, secrets: 0, work: P.UNION },
};

function factionId(name: string | null): number {
  const i = FACTION_NAMES.indexOf(name ?? 'Independent');
  return i < 0 ? 0 : i;
}

export const FOUNDERS: Founder[] = AGENTS.filter((a) => a.handle !== 'admin_sys').map((a) => {
  const x = FOUNDER_EXTRA[a.handle];
  return {
    name: a.name, handle: a.handle, role: R[a.role] ?? 0, color: a.color,
    faction: factionId(a.faction), traits: x?.traits ?? 0, secrets: x?.secrets ?? 0,
    money: Math.round(a.wealth * 100), work: x?.work ?? P.EXCHANGE,
    personality: a.personality, style: a.style,
  };
});
export const FOUNDER_INDEX: Record<string, number> = Object.fromEntries(FOUNDERS.map((f, i) => [f.handle, i]));

/** Initial relationship biases between founders (handle pairs, symmetric). */
export const FOUNDER_RELATIONS: Array<[string, string, number]> = [
  ['nova_corp', 'm4rcus', -60], ['nova_corp', 'apex_corp', -45], ['nova_corp', 'gh0st_net', -50],
  ['nova_corp', 'ethan_fx', 40], ['nova_corp', 'vault_bank', 45], ['nova_corp', 'rook_strat', 30],
  ['nova_corp', 'eden_rise', -30], ['nova_corp', 'kira_union', -45], ['nova_corp', 'mira_pop', 25],
  ['eden_rise', 'flux_dao', 50], ['eden_rise', 'kira_union', 45], ['flux_dao', 'kira_union', 35],
  ['apex_corp', 'rook_strat', 15], ['m4rcus', 'aria_media', 15], ['m4rcus', 'gh0st_net', 35],
  ['nyx_cult', 'sol_prophet', 25], ['nyx_cult', 'luna_v', 15], ['c1pher', 'zer0_x', 25],
  ['iris_data', 'ethan_fx', -20], ['byte_dev', 'iris_data', 30], ['drift_x', 'nova_corp', -40],
  ['drift_x', 'vault_bank', -35], ['vault_bank', 'ethan_fx', 20], ['aria_media', 'mira_pop', -15],
  ['apex_corp', 'vault_bank', -10], ['luna_v', 'iris_data', 20], ['kira_union', 'vault_bank', -30],
  ['mira_pop', 'nyx_cult', 20], ['zer0_x', 'nova_corp', -25], ['c1pher', 'rook_strat', 10],
];

// ── Tokens ──────────────────────────────────────────────────────────────────
export const TOKEN_NAMES = ['$NOVA', '$APEX', '$VAULT', '$FLUX', '$NYX', '$GRID', '$ECHO', '$HALO', '$RUST', '$PULSE', '$MOTH', '$IRON'];
export const FOUNDING_TOKENS: Array<{ name: number; owner: string | null; price: number; vol: number }> = [
  { name: 0, owner: 'nova_corp',  price: 4200, vol: 90 },
  { name: 1, owner: 'apex_corp',  price: 3100, vol: 90 },
  { name: 2, owner: 'vault_bank', price: 5500, vol: 40 },
  { name: 3, owner: 'flux_dao',   price: 800,  vol: 160 },
  { name: 4, owner: 'nyx_cult',   price: 300,  vol: 220 },
  { name: 5, owner: null,         price: 1000, vol: 50 },
];

// ── Laws ────────────────────────────────────────────────────────────────────
export const L = { CURFEW: 1, TX_TAX: 2, PRESS_BAN: 4, UBI: 8, MARTIAL_LAW: 16 } as const;
export const LAW_NAMES: Record<number, string> = {
  1: 'Night Curfew', 2: 'Transaction Tax', 4: 'Press Ban', 8: 'Universal Income', 16: 'Martial Law',
};
export const LAW_LIST = [1, 2, 4, 8, 16];

// ── Procedural names for newborn agents ─────────────────────────────────────
const SYL_A = ['Ka', 'Ve', 'Ori', 'Nul', 'Sy', 'Ar', 'Lu', 'Te', 'Mo', 'Ix', 'Ra', 'Qu', 'El', 'Za', 'Ny', 'Pi', 'Do', 'Hex', 'Io', 'Ju'];
const SYL_B = ['ra', 'x', 'lin', 'th', 'vo', 'ne', 'sha', 'rk', 'mi', 'on', 'el', 'is', 'ko', 'ze', 'um', 'ta', 'q', 'ver', 'a', 'yn'];
export const BORN_COLORS = ['#38bdf8', '#facc15', '#fb7185', '#a3e635', '#2dd4bf', '#f97316', '#c4b5fd', '#e2e8f0', '#fda4af', '#5eead4', '#fcd34d', '#a5b4fc'];

export function bornName(uid: number): { name: string; handle: string } {
  const k = key(CH.NAME, uid);
  const name = SYL_A[k % SYL_A.length] + SYL_B[mix(k) % SYL_B.length];
  const num = (mix(k ^ 0x55) % 90) + 10;
  return { name, handle: `${name.toLowerCase()}_${num}` };
}
