// World state: integers only. Serialization order is canonical (it defines the hash).
import {
  N_MAX, LOG_SIZE, MEM_SIZE, HIST_DAYS, VOTE_HIST, MAX_ARCS, MAX_TOKENS, MAX_GRAVES,
} from './config';
import { FOUNDERS, FOUNDER_INDEX, FOUNDER_RELATIONS, FOUNDING_TOKENS } from './roster';
import { CH, key } from './prng';

export type Agent = {
  uid: number;        // persistent identity (never reused)
  alive: number;      // 0 | 1
  origin: number;     // founder index, or -1 for born agents
  role: number;
  faction: number;
  color: number;      // born palette index (founders use config color)
  traits: number;
  born: number;       // world hour
  money: number;      // cents
  mood: number;       // -100..100
  energy: number;     // 0..100
  rep: number;        // -100..100
  corruption: number; // 0..100
  secrets: number;    // bitmask
  leaked: number;     // bitmask (subset of secrets that went public)
  work: number;       // workplace id
  override: number;   // place id or -1
  overrideUntil: number;
  bribedBy: number;   // uid or -1 (reset after each election)
  mem: number[];      // last MEM_SIZE event seqs
  hist: number[];     // money at the end of the last HIST_DAYS days (cents)
  votes: number[];    // last VOTE_HIST votes (candidate uid, -1 = none)
};

export type Token = { name: number; owner: number /* uid or -1 */; price: number; open: number; anchor: number; vol: number; listed: number; pressure: number };

export type Arc = { type: number; a: number; b: number; x: number; y: number; start: number; stage: number };

export type Grave = { uid: number; origin: number; role: number; faction: number; color: number; born: number; died: number; cause: number; money: number };

export type WorldEvent = {
  seq: number; hour: number; minute: number; sid: number;
  a: number; b: number; c: number;   // actor uids (-1 = SYSTEM / none)
  p0: number; p1: number; p2: number;
};

export type Politics = {
  president: number;   // uid, -1 = interim (SYSTEM)
  termStart: number;
  laws: number;
  lawSince: number[];  // hour each law bit (index 0..4) was enacted, -1 if off
  candidates: number[];// uids
  lastWinner: number;
  lastVotes: number[]; // [winnerVotes, runnerUid, runnerVotes, total]
  approval: number;    // -100..100
  motionHour: number;  // -1 = no impeachment motion
  elections: number;   // count
};

export type WorldState = {
  hour: number;          // number of macro steps applied
  seq: number;           // event counter
  nextUid: number;
  treasury: number;
  agents: Agent[];       // length N_MAX (slots); empty slot => uid -1
  rel: Int8Array;        // N_MAX * N_MAX, rel[i*N_MAX+j] = how i feels about j
  holdings: Int32Array;  // N_MAX * MAX_TOKENS
  tokens: Token[];
  politics: Politics;
  arcs: Arc[];
  cooldowns: Int32Array; // last fire hour per storylet
  log: WorldEvent[];     // ring, newest last (max LOG_SIZE)
  graves: Grave[];       // newest last (max MAX_GRAVES)
  deaths: number;
  births: number;
};

export const ARC = {
  SCANDAL: 1, ALLIANCE: 2, AFFAIR: 3, FEUD: 4, STRIKE: 5, CRASH: 6, BANKRUN: 7,
  PROPHECY: 8, BLACKMAIL: 9, FUNERAL: 10, BURNOUT: 11, DEFIANCE: 12, DETAINED: 13,
} as const;

export function emptyAgent(): Agent {
  return {
    uid: -1, alive: 0, origin: -1, role: 0, faction: 0, color: 0, traits: 0, born: 0,
    money: 0, mood: 0, energy: 0, rep: 0, corruption: 0, secrets: 0, leaked: 0, work: 0,
    override: -1, overrideUntil: 0, bribedBy: -1,
    mem: new Array(MEM_SIZE).fill(-1), hist: new Array(HIST_DAYS).fill(0), votes: new Array(VOTE_HIST).fill(-1),
  };
}

export function initialState(storyletCount: number): WorldState {
  const agents: Agent[] = [];
  for (let i = 0; i < N_MAX; i++) agents.push(emptyAgent());
  const rel = new Int8Array(N_MAX * N_MAX);

  FOUNDERS.forEach((f, i) => {
    const a = agents[i];
    a.uid = i; a.alive = 1; a.origin = i; a.role = f.role; a.faction = f.faction;
    a.traits = f.traits; a.secrets = f.secrets; a.money = f.money; a.work = f.work;
    a.mood = 10; a.energy = 80; a.rep = 10; a.corruption = f.secrets ? 25 : 5;
    a.hist.fill(f.money);
  });
  const n = FOUNDERS.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      let v = (key(CH.INIT, i, j) % 21) - 10;
      if (agents[i].faction === agents[j].faction && agents[i].faction !== 0) v += 25;
      rel[i * N_MAX + j] = v;
    }
  }
  for (const [ha, hb, v] of FOUNDER_RELATIONS) {
    const i = FOUNDER_INDEX[ha], j = FOUNDER_INDEX[hb];
    if (i === undefined || j === undefined) continue;
    rel[i * N_MAX + j] = clampRel(v + (key(CH.INIT, j, i, 7) % 11) - 5);
    rel[j * N_MAX + i] = clampRel(v + (key(CH.INIT, i, j, 7) % 11) - 5);
  }

  const tokens: Token[] = FOUNDING_TOKENS.map((t) => ({
    name: t.name, owner: t.owner === null ? -1 : FOUNDER_INDEX[t.owner], price: t.price,
    open: t.price, anchor: t.price, vol: t.vol, listed: 1, pressure: 0,
  }));
  const holdings = new Int32Array(N_MAX * MAX_TOKENS);
  // Owners hold their own token; brokers and bankers hold a basket.
  tokens.forEach((t, ti) => { if (t.owner >= 0) holdings[t.owner * MAX_TOKENS + ti] = 400; });
  for (let i = 0; i < n; i++) {
    for (let ti = 0; ti < tokens.length; ti++) holdings[i * MAX_TOKENS + ti] += key(CH.INIT, i, ti, 3) % 30;
  }

  return {
    hour: 0, seq: 0, nextUid: n, treasury: 5_000_000,
    agents, rel, holdings, tokens,
    politics: {
      president: -1, termStart: 0, laws: 0, lawSince: [-1, -1, -1, -1, -1], candidates: [],
      lastWinner: -1, lastVotes: [0, -1, 0, 0], approval: 0, motionHour: -1, elections: 0,
    },
    arcs: [],
    cooldowns: new Int32Array(storyletCount).fill(-100000),
    log: [], graves: [], deaths: 0, births: 0,
  };
}

export function clampRel(v: number): number { return v > 100 ? 100 : v < -100 ? -100 : v | 0; }

export function cloneState(s: WorldState): WorldState {
  return {
    ...s,
    agents: s.agents.map((a) => ({ ...a, mem: a.mem.slice(), hist: a.hist.slice(), votes: a.votes.slice() })),
    rel: s.rel.slice(), holdings: s.holdings.slice(),
    tokens: s.tokens.map((t) => ({ ...t })),
    politics: { ...s.politics, lawSince: s.politics.lawSince.slice(), candidates: s.politics.candidates.slice(), lastVotes: s.politics.lastVotes.slice() },
    arcs: s.arcs.map((a) => ({ ...a })),
    cooldowns: s.cooldowns.slice(),
    log: s.log.map((e) => ({ ...e })),
    graves: s.graves.map((g) => ({ ...g })),
  };
}

// ── Serialization (int32 words) ─────────────────────────────────────────────
const VERSION = 1;

class Writer {
  w: number[] = [];
  i(v: number) { this.w.push(v | 0); }
  arr(a: ArrayLike<number>) { this.i(a.length); for (let k = 0; k < a.length; k++) this.i(a[k]); }
}
class Reader {
  p = 0;
  constructor(private w: Int32Array) {}
  i(): number { return this.w[this.p++]; }
  arr(): number[] { const n = this.i(); const out = new Array(n); for (let k = 0; k < n; k++) out[k] = this.i(); return out; }
}

const AGENT_FIELDS: Array<keyof Agent> = [
  'uid', 'alive', 'origin', 'role', 'faction', 'color', 'traits', 'born', 'money', 'mood', 'energy',
  'rep', 'corruption', 'secrets', 'leaked', 'work', 'override', 'overrideUntil', 'bribedBy',
];
const EVENT_FIELDS: Array<keyof WorldEvent> = ['seq', 'hour', 'minute', 'sid', 'a', 'b', 'c', 'p0', 'p1', 'p2'];
const TOKEN_FIELDS: Array<keyof Token> = ['name', 'owner', 'price', 'open', 'anchor', 'vol', 'listed', 'pressure'];
const ARC_FIELDS: Array<keyof Arc> = ['type', 'a', 'b', 'x', 'y', 'start', 'stage'];
const GRAVE_FIELDS: Array<keyof Grave> = ['uid', 'origin', 'role', 'faction', 'color', 'born', 'died', 'cause', 'money'];

export function serialize(s: WorldState): Int32Array {
  const w = new Writer();
  w.i(VERSION); w.i(s.hour); w.i(s.seq); w.i(s.nextUid); w.i(s.treasury); w.i(s.deaths); w.i(s.births);
  w.i(s.agents.length);
  for (const a of s.agents) {
    for (const f of AGENT_FIELDS) w.i(a[f] as number);
    w.arr(a.mem); w.arr(a.hist); w.arr(a.votes);
  }
  w.arr(s.rel); w.arr(s.holdings);
  w.i(s.tokens.length); for (const t of s.tokens) for (const f of TOKEN_FIELDS) w.i(t[f]);
  const p = s.politics;
  w.i(p.president); w.i(p.termStart); w.i(p.laws); w.arr(p.lawSince); w.arr(p.candidates);
  w.i(p.lastWinner); w.arr(p.lastVotes); w.i(p.approval); w.i(p.motionHour); w.i(p.elections);
  w.i(s.arcs.length); for (const a of s.arcs) for (const f of ARC_FIELDS) w.i(a[f]);
  w.arr(s.cooldowns);
  w.i(s.log.length); for (const e of s.log) for (const f of EVENT_FIELDS) w.i(e[f]);
  w.i(s.graves.length); for (const g of s.graves) for (const f of GRAVE_FIELDS) w.i(g[f]);
  return Int32Array.from(w.w);
}

export function deserialize(words: Int32Array): WorldState {
  const r = new Reader(words);
  if (r.i() !== VERSION) throw new Error('checkpoint version mismatch');
  const hour = r.i(), seq = r.i(), nextUid = r.i(), treasury = r.i(), deaths = r.i(), births = r.i();
  const na = r.i();
  const agents: Agent[] = [];
  for (let k = 0; k < na; k++) {
    const a = emptyAgent() as unknown as Record<string, number | number[]>;
    for (const f of AGENT_FIELDS) a[f] = r.i();
    a.mem = r.arr(); a.hist = r.arr(); a.votes = r.arr();
    agents.push(a as unknown as Agent);
  }
  const rel = Int8Array.from(r.arr());
  const holdings = Int32Array.from(r.arr());
  const nt = r.i(); const tokens: Token[] = [];
  for (let k = 0; k < nt; k++) { const t = {} as Record<string, number>; for (const f of TOKEN_FIELDS) t[f] = r.i(); tokens.push(t as unknown as Token); }
  const president = r.i(), termStart = r.i(), laws = r.i(), lawSince = r.arr(), candidates = r.arr();
  const lastWinner = r.i(), lastVotes = r.arr(), approval = r.i(), motionHour = r.i(), elections = r.i();
  const narc = r.i(); const arcs: Arc[] = [];
  for (let k = 0; k < narc; k++) { const a = {} as Record<string, number>; for (const f of ARC_FIELDS) a[f] = r.i(); arcs.push(a as unknown as Arc); }
  const cooldowns = Int32Array.from(r.arr());
  const nl = r.i(); const log: WorldEvent[] = [];
  for (let k = 0; k < nl; k++) { const e = {} as Record<string, number>; for (const f of EVENT_FIELDS) e[f] = r.i(); log.push(e as unknown as WorldEvent); }
  const ng = r.i(); const graves: Grave[] = [];
  for (let k = 0; k < ng; k++) { const g = {} as Record<string, number>; for (const f of GRAVE_FIELDS) g[f] = r.i(); graves.push(g as unknown as Grave); }
  return {
    hour, seq, nextUid, treasury, agents, rel, holdings, tokens,
    politics: { president, termStart, laws, lawSince, candidates, lastWinner, lastVotes, approval, motionHour, elections },
    arcs, cooldowns, log, graves, deaths, births,
  };
}

/** 64-bit state hash (two 32-bit FNV-style lanes), hex. */
export function hashWords(words: Int32Array): string {
  let h1 = 0x811c9dc5 | 0, h2 = 0x01000193 ^ 0x5bd1e995;
  for (let k = 0; k < words.length; k++) {
    const v = words[k];
    h1 = Math.imul(h1 ^ v, 0x01000193);
    h2 = Math.imul(h2 ^ ((v << 13) | (v >>> 19)), 0x5bd1e995);
    h2 ^= h2 >>> 15;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function stateHash(s: WorldState): string { return hashWords(serialize(s)); }

export { LOG_SIZE, MAX_ARCS, MAX_TOKENS, MAX_GRAVES };
