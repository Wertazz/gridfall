// The narrative engine: 69 storylets. Each one reads the state, may fire, mutates
// the state with integer effects and emits one event (rendered later as dialogue).
import { N_MAX, MAX_TOKENS, MIN_ALIVE, BIRTH_CAP, MAX_GRAVES, MAX_TOKENS as MT, HIST_DAYS, DAY_HOURS, ELECTION_DAYS } from './config';
import { P, T, S, L, F, LAW_LIST, BORN_ROLES, BORN_COLORS, FACTION_NAMES } from './roster';
import { ARC, emptyAgent } from './state';
import { CH, key } from './prng';
import { isNight } from './routine';
import type { Ctx } from './ctx';

export const CAT = { ECONOMY: 0, MEDIA: 1, POLITICS: 2, RELATIONS: 3, LABOR: 4, CULT: 5, LIFE: 6, TECH: 7, AMBIENT: 8 } as const;
export const CAT_NAMES = ['economy', 'media', 'politics', 'relations', 'labor', 'cult', 'life', 'tech', 'ambient'];

/** major: 0 = chatter, 1 = notable (Wire highlight), 2 = historic (timeline marker). */
export type Storylet = { id: string; cat: number; p: number; cd: number; major: 0 | 1 | 2; forced?: boolean; run: (c: Ctx) => boolean };

const pct = (v: number, p: number) => ((v * p) / 100) | 0;
const has = (c: Ctx, i: number, t: number) => (c.ag(i).traits & t) !== 0;
const unleaked = (c: Ctx, i: number) => c.ag(i).secrets & ~c.ag(i).leaked;
function lowestBit(m: number): number { for (let b = 1; b <= 128; b <<= 1) if (m & b) return b; return 0; }
function pickBit(c: Ctx, m: number): number { const bits: number[] = []; for (let b = 1; b <= 128; b <<= 1) if (m & b) bits.push(b); return bits.length ? c.rng.pick(bits) : 0; }
function leak(c: Ctx, i: number, bit: number) { const a = c.ag(i); a.leaked |= bit; a.secrets |= bit; }
const pressBanned = (c: Ctx) => c.law(L.PRESS_BAN);
const corpOwners = (c: Ctx) => c.where((i) => c.tokenOf(i) >= 0 && c.roleIn(i, 'CEO', 'Rival CEO', 'Banker'));

// ── Death & birth helpers (also used by the step guards) ────────────────────
export function killAgent(c: Ctx, i: number, cause: number): number {
  const s = c.s; const a = c.ag(i);
  // Inheritance: up to three closest friends, else the treasury.
  const heirs = c.where((j) => j !== i && c.rel(i, j) > 20).sort((x, y) => c.rel(i, y) - c.rel(i, x) || x - y).slice(0, 3);
  const estate = a.money;
  a.money = 0;
  if (heirs.length) { const share = (estate / heirs.length) | 0; for (const h of heirs) c.pay(h, share); }
  else s.treasury += estate;
  for (let t = 0; t < s.tokens.length; t++) {
    const q = c.holding(i, t);
    if (q > 0) { if (heirs.length) c.addHolding(heirs[0], t, q); c.addHolding(i, t, -q); }
    if (s.tokens[t].owner === a.uid) s.tokens[t].owner = heirs.length ? c.uid(heirs[0]) : -1;
  }
  s.graves.push({ uid: a.uid, origin: a.origin, role: a.role, faction: a.faction, color: a.color, born: a.born, died: c.h, cause, money: estate });
  if (s.graves.length > MAX_GRAVES) s.graves.shift();
  s.deaths++;
  if (s.politics.president === a.uid) s.politics.president = -1;
  s.politics.candidates = s.politics.candidates.filter((u) => u !== a.uid);
  s.arcs = s.arcs.filter((arc) => arc.type === ARC.FUNERAL || (arc.a !== a.uid && arc.b !== a.uid));
  for (const j of c.alive()) if (j !== i && c.rel(j, i) > 20) c.mood(j, -25);
  a.alive = 0;
  c.dirty();
  c.open(ARC.FUNERAL, a.uid, heirs.length ? c.uid(heirs[0]) : -1, i);
  return heirs.length ? c.uid(heirs[0]) : -1;
}

export function birthAgent(c: Ctx): number {
  const s = c.s;
  let slot = -1;
  for (let i = 0; i < N_MAX; i++) if (!s.agents[i].alive) { slot = i; break; }
  if (slot < 0) return -1;
  const uid = s.nextUid++;
  const k = key(CH.BIRTH, uid);
  const a = emptyAgent();
  a.uid = uid; a.alive = 1; a.origin = -1; a.born = c.h;
  a.role = BORN_ROLES[k % BORN_ROLES.length];
  a.color = (k >>> 8) % BORN_COLORS.length;
  a.faction = [F.INDEPENDENT, F.INDEPENDENT, F.EDEN, F.NOVACORP, F.NYX, F.APEXCORP][(k >>> 12) % 6];
  const tb = [T.AMBITIOUS, T.GREEDY, T.LOYAL, T.PARANOID, T.ROMANTIC, T.ZEALOT, T.HONEST, T.VOLATILE, T.CHARISMATIC, T.RECLUSIVE];
  a.traits = tb[(k >>> 16) % 10] | tb[(k >>> 20) % 10];
  a.money = 100000; a.mood = 30; a.energy = 100; a.rep = 0; a.corruption = 0;
  a.work = [P.EXCHANGE, P.WIRE, P.ALLEY, P.EDEN, P.NYX, P.RUINS, P.VAULT, P.NOODLE][(k >>> 24) % 8];
  a.hist.fill(a.money);
  s.agents[slot] = a;
  for (let j = 0; j < N_MAX; j++) { s.rel[slot * N_MAX + j] = 0; s.rel[j * N_MAX + slot] = 0; }
  for (let t = 0; t < MT; t++) s.holdings[slot * MAX_TOKENS + t] = 0;
  c.dirty();
  s.births++;
  return slot;
}

// ── Voting ──────────────────────────────────────────────────────────────────
function runElection(c: Ctx): { winner: number; runner: number; wv: number; rv: number; total: number } {
  const s = c.s; const cands = s.politics.candidates.map((u) => c.slot(u)).filter((i) => i >= 0);
  const tally = new Array(cands.length).fill(0);
  let total = 0;
  for (const v of c.alive()) {
    let best = -1, bestScore = -100000;
    for (let k = 0; k < cands.length; k++) {
      const cd = cands[k];
      let sc: number;
      if (cd === v) sc = 1000;
      else {
        sc = c.rel(v, cd) + (c.ag(v).faction === c.ag(cd).faction && c.ag(v).faction !== F.INDEPENDENT ? 30 : 0) + (c.ag(cd).rep >> 1);
        if (s.politics.president === c.uid(cd)) sc += c.ag(v).mood >> 1;
        if (c.ag(v).bribedBy === c.uid(cd)) sc += 45;
        sc += (key(CH.VOTE, c.h, c.uid(v), c.uid(cd)) % 21) - 10;
      }
      if (sc > bestScore || (sc === bestScore && c.uid(cd) < c.uid(cands[best]))) { bestScore = sc; best = k; }
    }
    if (best >= 0) {
      tally[best]++; total++;
      const vh = c.ag(v).votes; vh.shift(); vh.push(c.uid(cands[best]));
    }
  }
  const order = cands.map((_, k) => k).sort((x, y) => tally[y] - tally[x] || c.ag(cands[y]).rep - c.ag(cands[x]).rep || c.uid(cands[x]) - c.uid(cands[y]));
  return { winner: cands[order[0]], runner: order.length > 1 ? cands[order[1]] : -1, wv: tally[order[0]], rv: order.length > 1 ? tally[order[1]] : 0, total };
}

export function approval(c: Ctx): number {
  const pres = c.president(); if (pres < 0) return 0;
  let sum = 0, n = 0;
  for (const i of c.alive()) { if (i === pres) continue; sum += c.rel(i, pres) + (c.ag(i).mood >> 1); n++; }
  const v = n ? (sum / n) | 0 : 0;
  return v > 100 ? 100 : v < -100 ? -100 : v;
}

function enactLaw(c: Ctx, bit: number, on: boolean) {
  const p = c.s.politics; const idx = LAW_LIST.indexOf(bit);
  if (on) { p.laws |= bit; p.lawSince[idx] = c.h; } else { p.laws &= ~bit; p.lawSince[idx] = -1; }
}

const phase = (c: Ctx) => c.wd <= 1 ? 'candidacy' : c.wd <= 4 ? 'campaign' : c.wd === 5 ? 'debate' : 'vote';

// ═════════════════════════════════════════════════════════════════════════════
export const STORYLETS: Storylet[] = [
  // ── ECONOMY ────────────────────────────────────────────────────────────────
  { id: 'market_rally', cat: CAT.ECONOMY, p: 352, cd: 14, major: 0, run: (c) => {
    const tk = c.pick(c.listed(), (t) => c.s.tokens[t].price >= c.s.tokens[t].open ? 3 : 1); if (tk < 0) return false;
    const fan = c.pick(c.where((i) => c.roleIn(i, 'Broker', 'Influencer', 'Data Analyst') || c.holding(i, tk) > 50)); if (fan < 0) return false;
    const bp = c.rng.range(400, 1100); c.pressure(tk, bp);
    const owner = c.slot(c.s.tokens[tk].owner); c.mood(owner, 10); c.mood(fan, 6);
    c.emit(fan, owner, -1, tk, bp); return true; } },

  { id: 'market_crash', cat: CAT.ECONOMY, p: 99, cd: 60, major: 2, run: (c) => {
    const tk = c.pick(c.listed(), (t) => { const o = c.slot(c.s.tokens[t].owner); return 2 + (o >= 0 && c.ag(o).rep < 0 ? 6 : 0) + (c.arc(ARC.SCANDAL, (a) => a.b === c.s.tokens[t].owner) ? 8 : 0); });
    if (tk < 0 || c.arc(ARC.CRASH, (a) => a.x === tk)) return false;
    const bp = -c.rng.range(1400, 3200); c.pressure(tk, bp);
    const owner = c.slot(c.s.tokens[tk].owner); c.mood(owner, -25); c.rep(owner, -6);
    for (const i of c.alive()) if (c.holding(i, tk) > 40) c.mood(i, -10);
    c.open(ARC.CRASH, c.s.tokens[tk].owner, -1, tk);
    const voice = c.pick(c.where((i) => c.roleIn(i, 'Data Analyst', 'Broker', 'Banker') && i !== owner));
    c.emit(voice, owner, -1, tk, bp); return true; } },

  { id: 'bank_run', cat: CAT.ECONOMY, p: 572, cd: 150, major: 2, run: (c) => {
    const vaultTk = c.s.tokens.findIndex((t) => t.name === 2 && t.listed);
    const crash = c.arc(ARC.CRASH, (a) => c.h - a.start < 30);
    const banker = c.pick(c.where((i) => c.role(i, 'Banker'))); if (banker < 0) return false;
    if (!crash && c.ag(banker).rep > -35) return false;
    const lost = pct(c.ag(banker).money, 18); c.take(banker, lost); c.s.treasury += lost >> 1;
    c.mood(banker, -30); c.rep(banker, -10); if (vaultTk >= 0) c.pressure(vaultTk, -2200);
    c.open(ARC.BANKRUN, c.uid(banker), -1, lost);
    const panicker = c.pickOther(c.where((i) => c.ag(i).money > 50000), banker, (i) => has(c, i, T.PARANOID) ? 4 : 1);
    c.emit(panicker, banker, -1, lost); return true; } },

  { id: 'hostile_takeover', cat: CAT.ECONOMY, p: 48, cd: 200, major: 2, run: (c) => {
    const raider = c.pick(corpOwners(c), (i) => (has(c, i, T.AMBITIOUS) ? 3 : 1) * (c.ag(i).money > 400000 ? 2 : 0)); if (raider < 0) return false;
    const tk = c.pick(c.listed(), (t) => { const tt = c.s.tokens[t]; const o = c.slot(tt.owner); return o >= 0 && o !== raider && c.rel(raider, o) < 0 && (tt.price * 10 < tt.anchor * 8 || c.arc(ARC.CRASH, (a) => a.x === t) !== null) ? 1 : 0; });
    if (tk < 0) return false;
    const victim = c.slot(c.s.tokens[tk].owner);
    const price = Math.min(c.ag(raider).money >> 1, c.s.tokens[tk].price * 120);
    c.transfer(raider, victim, price);
    c.s.tokens[tk].owner = c.uid(raider); c.mood(victim, -40); c.mood(raider, 25); c.addRel2(raider, victim, -40); c.rep(raider, 5);
    c.emit(raider, victim, -1, tk, price); return true; } },

  { id: 'insider_trade', cat: CAT.ECONOMY, p: 198, cd: 24, major: 0, run: (c) => {
    const a = c.pick(c.where((i) => (c.ag(i).secrets & S.INSIDER) !== 0 || c.ag(i).corruption > 55)); if (a < 0) return false;
    const tk = c.pick(c.listed()); if (tk < 0) return false;
    const gain = c.rng.range(20000, 90000); c.pay(a, gain); c.corrupt(a, 6); c.ag(a).secrets |= S.INSIDER;
    c.emit(a, c.slot(c.s.tokens[tk].owner), -1, tk, gain); return true; } },

  { id: 'pump_and_dump', cat: CAT.ECONOMY, p: 121, cd: 72, major: 1, run: (c) => {
    const a = c.pick(c.where((i) => c.roleIn(i, 'Influencer', 'Broker') && c.ag(i).corruption > 15)); if (a < 0) return false;
    const tk = c.pick(c.listed(), (t) => c.s.tokens[t].price < 1500 ? 3 : 1); if (tk < 0) return false;
    c.pressure(tk, 1500); const gain = c.rng.range(30000, 120000); c.pay(a, gain); c.corrupt(a, 10); c.rep(a, -6);
    for (const i of c.alive()) if (i !== a && c.holding(i, tk) > 30) c.addRel(i, a, -6);
    c.emit(a, -1, -1, tk, gain); return true; } },

  { id: 'token_launch', cat: CAT.ECONOMY, p: 48, cd: 260, major: 2, run: (c) => {
    const s = c.s;
    let ti = s.tokens.findIndex((t) => !t.listed);
    if (ti < 0 && s.tokens.length < MAX_TOKENS) ti = s.tokens.length;
    if (ti < 0) return false;
    const a = c.pick(c.where((i) => c.tokenOf(i) < 0 && c.ag(i).money > 300000 && c.roleIn(i, 'CEO', 'Rival CEO', 'DAO Leader', 'Mystic', 'Influencer', 'Engineer', 'Hacker', 'Broker'))); if (a < 0) return false;
    const used = new Set(s.tokens.filter((t) => t.listed).map((t) => t.name));
    const free = [6, 7, 8, 9, 10, 11, 1, 3, 4].filter((n) => !used.has(n)); if (!free.length) return false;
    const name = c.rng.pick(free); const price = c.rng.range(200, 1800);
    const tok = { name, owner: c.uid(a), price, open: price, anchor: price, vol: c.rng.range(80, 220), listed: 1, pressure: 0 };
    if (ti === s.tokens.length) s.tokens.push(tok); else s.tokens[ti] = tok;
    for (let j = 0; j < N_MAX; j++) s.holdings[j * MAX_TOKENS + ti] = 0;
    c.take(a, 200000); c.addHolding(a, ti, 500); c.mood(a, 20); c.rep(a, 4);
    c.emit(a, -1, -1, ti, price); return true; } },

  { id: 'token_delisting', cat: CAT.ECONOMY, p: 880, cd: 12, major: 2, run: (c) => {
    const tk = c.pick(c.listed(), (t) => (c.s.tokens[t].price * 6 < c.s.tokens[t].anchor ? 1 : 0)); if (tk < 0) return false;
    const owner = c.slot(c.s.tokens[tk].owner);
    c.s.tokens[tk].listed = 0; c.mood(owner, -30); c.rep(owner, -15);
    for (const i of c.alive()) { if (c.holding(i, tk) > 0) c.mood(i, -8); c.addHolding(i, tk, -c.holding(i, tk)); }
    c.emit(-1, owner, -1, tk); return true; } },

  { id: 'loan_default', cat: CAT.ECONOMY, p: 484, cd: 24, major: 1, run: (c) => {
    const d = c.pick(c.where((i) => c.ag(i).money < 30000)); if (d < 0) return false;
    const banker = c.pickOther(c.where((i) => c.role(i, 'Banker')), d);
    c.rep(d, -12); c.mood(d, -20); leak(c, d, S.DEBT); if (banker >= 0) c.addRel(banker, d, -20);
    c.emit(d, banker); return true; } },

  { id: 'bailout', cat: CAT.ECONOMY, p: 352, cd: 96, major: 2, run: (c) => {
    const arc = c.arc(ARC.BANKRUN) ?? c.arc(ARC.CRASH); if (!arc || c.s.treasury < 600000) return false;
    const target = c.slot(arc.a); if (target < 0) return false;
    const pres = c.president();
    const amt = Math.min(c.s.treasury >> 2, 400000); c.s.treasury -= amt; c.pay(target, amt);
    c.mood(target, 20); if (pres >= 0) { for (const i of c.alive()) if (c.ag(i).faction === F.EDEN) c.addRel(i, pres, -6); c.addRel(target, pres, 20); }
    c.close(arc);
    c.emit(pres, target, -1, amt); return true; } },

  { id: 'merger', cat: CAT.ECONOMY, p: 14, cd: 400, major: 2, run: (c) => {
    const owners = corpOwners(c); const a = c.pick(owners); if (a < 0) return false;
    const b = c.pickOther(owners, a, (j) => (c.rel(a, j) > 40 ? 1 : 0)); if (b < 0) return false;
    c.ag(b).faction = c.ag(a).faction; c.addRel2(a, b, 15); c.pressure(c.tokenOf(a), 900); c.pressure(c.tokenOf(b), 900);
    c.emit(a, b, -1, c.tokenOf(a), c.tokenOf(b)); return true; } },

  { id: 'price_war', cat: CAT.ECONOMY, p: 132, cd: 72, major: 1, run: (c) => {
    const owners = corpOwners(c); const a = c.pick(owners); if (a < 0) return false;
    const b = c.pickOther(owners, a, (j) => (c.rel(a, j) < -20 ? 1 : 0)); if (b < 0) return false;
    c.pressure(c.tokenOf(a), -450); c.pressure(c.tokenOf(b), -450);
    c.take(a, pct(c.ag(a).money, 2)); c.take(b, pct(c.ag(b).money, 2)); c.addRel2(a, b, -10);
    c.emit(a, b, -1, c.tokenOf(a), c.tokenOf(b)); return true; } },

  { id: 'tax_evasion_exposed', cat: CAT.ECONOMY, p: 154, cd: 72, major: 1, run: (c) => {
    if (pressBanned(c)) return false;
    const j = c.pick(c.where((i) => c.roleIn(i, 'Journalist', 'Data Analyst', 'Whistleblower'))); if (j < 0) return false;
    const t = c.pickOther(c.where((i) => (unleaked(c, i) & (S.EMBEZZLE | S.INSIDER)) !== 0 && c.ag(i).money > 300000), j); if (t < 0) return false;
    leak(c, t, lowestBit(unleaked(c, t) & (S.EMBEZZLE | S.INSIDER))); c.rep(t, -20); c.mood(t, -15); c.rep(j, 8); c.addRel2(j, t, -20);
    const fine = pct(c.ag(t).money, 8); c.take(t, fine); c.s.treasury += fine;
    c.emit(j, t, -1, fine); return true; } },

  { id: 'windfall', cat: CAT.ECONOMY, p: 154, cd: 24, major: 0, run: (c) => {
    const a = c.pick(c.where((i) => c.ag(i).money < 150000)); if (a < 0) return false;
    const amt = c.rng.range(40000, 160000); c.pay(a, amt); c.mood(a, 22);
    c.emit(a, -1, -1, amt); return true; } },

  // ── MEDIA ──────────────────────────────────────────────────────────────────
  { id: 'investigation_opened', cat: CAT.MEDIA, p: 440, cd: 20, major: 1, run: (c) => {
    const j = c.pick(c.where((i) => c.roleIn(i, 'Journalist', 'Whistleblower', 'Hacker') && !c.inArc(ARC.SCANDAL, c.uid(i)))); if (j < 0) return false;
    const t = c.pickOther(c.where((i) => unleaked(c, i) !== 0), j, (i) => Math.max(1, 60 - c.rel(j, i))); if (t < 0) return false;
    if (!c.open(ARC.SCANDAL, c.uid(j), c.uid(t))) return false;
    c.send(j, P.ALLEY, 3); c.mood(j, 8);
    c.emit(j, t); return true; } },

  { id: 'leak_drop', cat: CAT.MEDIA, p: 660, cd: 10, major: 2, run: (c) => {
    if (pressBanned(c)) return false;
    const arc = c.arc(ARC.SCANDAL, (a) => a.stage === 0 && c.h - a.start >= 6); if (!arc) return false;
    const t = c.slot(arc.b); const j = c.slot(arc.a); if (t < 0) return false;
    const leaker = c.pick(c.where((i) => i !== t && c.roleIn(i, 'Whistleblower', 'Ghost', 'Hacker'))) ;
    const who = leaker >= 0 ? leaker : j;
    const bit = pickBit(c, unleaked(c, t)); if (!bit) { c.close(arc); return false; }
    leak(c, t, bit); arc.stage = 1; arc.x = bit;
    c.rep(t, -10); c.mood(t, -15); c.addRel(t, who, -25); c.pressure(c.tokenOf(t), -700);
    c.emit(who, t, j, bit); return true; } },

  { id: 'investigation_published', cat: CAT.MEDIA, p: 704, cd: 6, major: 2, run: (c) => {
    if (pressBanned(c)) return false;
    const arc = c.arc(ARC.SCANDAL, (a) => a.stage === 1 && c.h - a.start >= 14); if (!arc) return false;
    const j = c.slot(arc.a), t = c.slot(arc.b); c.close(arc); if (j < 0 || t < 0) return false;
    c.rep(t, -25); c.mood(t, -30); c.pressure(c.tokenOf(t), -1800); c.rep(j, 15); c.pay(j, 80000); c.addRel2(j, t, -30);
    for (const i of c.alive()) if (i !== t && c.ag(i).faction === F.EDEN) c.addRel(i, t, -8);
    c.emit(j, t, -1, arc.x); return true; } },

  { id: 'source_burned', cat: CAT.MEDIA, p: 286, cd: 48, major: 1, run: (c) => {
    const arc = c.arc(ARC.SCANDAL, (a) => { const t = c.slot(a.b); return t >= 0 && (c.ag(t).corruption > 40 || c.role(t, 'Strategist') || has(c, t, T.PARANOID)); }); if (!arc) return false;
    const t = c.slot(arc.b), j = c.slot(arc.a); c.close(arc); if (j < 0) return false;
    c.mood(j, -20); c.addRel2(j, t, -20); c.corrupt(t, 5);
    c.emit(t, j); return true; } },

  { id: 'fake_news', cat: CAT.MEDIA, p: 198, cd: 36, major: 0, run: (c) => {
    const a = c.pick(c.where((i) => c.roleIn(i, 'Influencer', 'Anarchist', 'Strategist'))); if (a < 0) return false;
    const b = c.pickOther(c.alive(), a, (i) => Math.max(0, -c.rel(a, i))); if (b < 0) return false;
    c.rep(b, -8); c.rep(a, -3); c.addRel(b, a, -15);
    c.emit(a, b); return true; } },

  { id: 'press_ban_defied', cat: CAT.MEDIA, p: 770, cd: 24, major: 2, run: (c) => {
    if (!pressBanned(c)) return false;
    const j = c.pick(c.where((i) => c.roleIn(i, 'Journalist', 'Whistleblower') && !c.inArc(ARC.DETAINED, c.uid(i)))); if (j < 0) return false;
    const pres = c.president();
    c.rep(j, 20); c.addRel2(j, pres, -40);
    if (c.law(L.MARTIAL_LAW)) { c.energy(j, -40); c.send(j, P.EDEN, 12); c.open(ARC.DETAINED, c.uid(j), c.uid(pres)); }
    c.emit(j, pres, -1, c.law(L.MARTIAL_LAW) ? 1 : 0); return true; } },

  { id: 'retraction', cat: CAT.MEDIA, p: 176, cd: 48, major: 0, run: (c) => {
    const j = c.pick(c.where((i) => c.roleIn(i, 'Journalist', 'Influencer') && c.ag(i).rep < 0)); if (j < 0) return false;
    const b = c.pickOther(c.alive(), j, (i) => (c.rel(j, i) < -10 ? 1 : 0)); if (b < 0) return false;
    c.rep(j, -6); c.addRel2(j, b, 10);
    c.emit(j, b); return true; } },

  { id: 'exclusive_interview', cat: CAT.MEDIA, p: 264, cd: 24, major: 0, run: (c) => {
    if (pressBanned(c)) return false;
    const j = c.pick(c.where((i) => c.role(i, 'Journalist'))); if (j < 0) return false;
    const b = c.pickOther(c.alive(), j, (i) => (c.s.politics.candidates.includes(c.uid(i)) || c.s.politics.president === c.uid(i) ? 6 : 1) + Math.max(0, c.ag(i).rep >> 3)); if (b < 0) return false;
    c.rep(j, 4); c.rep(b, 4); c.addRel2(j, b, 8); c.send(b, P.WIRE, 2);
    c.emit(j, b); return true; } },

  // ── POLITICS ───────────────────────────────────────────────────────────────
  { id: 'candidacy_declared', cat: CAT.POLITICS, p: 4840, cd: 3, major: 1, run: (c) => {
    if (phase(c) !== 'candidacy' || c.s.politics.candidates.length >= 4 || c.hod < 8 || c.hod > 21) return false;
    const a = c.pick(c.where((i) => !c.s.politics.candidates.includes(c.uid(i)) && c.ag(i).rep > -20), (i) =>
      (has(c, i, T.AMBITIOUS) ? 20 : 2) + (c.roleIn(i, 'Politician', 'DAO Leader', 'Union Leader', 'CEO', 'Rival CEO') ? 20 : 0) + Math.max(0, c.ag(i).rep) + (has(c, i, T.RECLUSIVE) ? -30 : 0));
    if (a < 0) return false;
    c.s.politics.candidates.push(c.uid(a)); c.send(a, P.EDEN, 2); c.rep(a, 3);
    c.emit(a, -1, -1, 0); return true; } },

  { id: 'campaign_visit', cat: CAT.POLITICS, p: 3520, cd: 2, major: 0, run: (c) => {
    if (phase(c) !== 'campaign' || c.hod < 9 || c.hod > 19) return false;
    const a = c.pick(c.s.politics.candidates.map((u) => c.slot(u)).filter((i) => i >= 0)); if (a < 0) return false;
    const b = c.pickOther(c.alive(), a, (i) => (c.rel(i, a) > -30 && c.rel(i, a) < 50 && !c.s.politics.candidates.includes(c.uid(i)) ? 1 : 0)); if (b < 0) return false;
    const pl = c.place(b); c.send(a, pl, 2); c.addRel(b, a, c.rng.range(2, 9) + (has(c, a, T.CHARISMATIC) ? 4 : 0)); c.energy(a, -6);
    c.emit(a, b, -1, pl); return true; } },

  { id: 'debate', cat: CAT.POLITICS, p: 10000, cd: 20, major: 2, forced: true, run: (c) => {
    if (c.wd !== 5 || c.hod !== 20) return false;
    const cands = c.s.politics.candidates.map((u) => c.slot(u)).filter((i) => i >= 0); if (cands.length < 2) return false;
    const score = (i: number) => (c.ag(i).rep >> 1) + (has(c, i, T.CHARISMATIC) ? 18 : 0) + (has(c, i, T.HONEST) ? 6 : 0) + (key(CH.VOTE, c.h, c.uid(i), 99) % 30);
    const ranked = cands.slice().sort((x, y) => score(y) - score(x) || c.uid(x) - c.uid(y));
    const w = ranked[0], l = ranked[1];
    for (const i of c.alive()) { if (i !== w) c.addRel(i, w, 4); if (i !== l) c.addRel(i, l, -2); }
    c.mood(w, 15); c.mood(l, -10);
    c.emit(w, l, -1, cands.length, 0, 0, 30); return true; } },

  { id: 'endorsement', cat: CAT.POLITICS, p: 1320, cd: 6, major: 1, run: (c) => {
    if (phase(c) !== 'campaign') return false;
    const cands = c.s.politics.candidates.map((u) => c.slot(u)).filter((i) => i >= 0);
    const a = c.pick(c.where((i) => !cands.includes(i) && c.ag(i).rep > 5)); if (a < 0) return false;
    const cd = c.pick(cands, (i) => (c.rel(a, i) > 40 ? 1 : 0)); if (cd < 0) return false;
    for (const x of c.alive()) if (x !== cd && c.rel(x, a) > 30) c.addRel(x, cd, 5);
    c.emit(a, cd); return true; } },

  { id: 'vote_buying', cat: CAT.POLITICS, p: 924, cd: 8, major: 1, run: (c) => {
    if (phase(c) !== 'campaign') return false;
    const a = c.pick(c.s.politics.candidates.map((u) => c.slot(u)).filter((i) => i >= 0 && (has(c, i, T.GREEDY) || c.ag(i).corruption > 30) && c.ag(i).money > 100000)); if (a < 0) return false;
    const b = c.pickOther(c.where((i) => c.ag(i).bribedBy < 0 && c.ag(i).money < 200000), a); if (b < 0) return false;
    const amt = c.rng.range(30000, 80000); c.transfer(a, b, amt); c.ag(b).bribedBy = c.uid(a); c.corrupt(a, 8); c.corrupt(b, 6); c.ag(a).secrets |= S.BRIBE;
    c.emit(a, b, -1, amt); return true; } },

  { id: 'election_result', cat: CAT.POLITICS, p: 10000, cd: 20, major: 2, forced: true, run: (c) => {
    if (c.wd !== 6 || c.hod !== 18) return false;
    const pol = c.s.politics; if (pol.candidates.length === 0) return false;
    const r = runElection(c); if (r.winner < 0) return false;
    const prev = c.president();
    pol.president = c.uid(r.winner); pol.termStart = c.h; pol.lastWinner = pol.president;
    pol.lastVotes = [r.wv, c.uid(r.runner), r.rv, r.total]; pol.elections++; pol.motionHour = -1; pol.candidates = [];
    for (const i of c.alive()) c.ag(i).bribedBy = -1;
    c.mood(r.winner, 40); c.rep(r.winner, 10); if (r.runner >= 0) c.mood(r.runner, -20);
    if (prev >= 0 && prev !== r.winner) c.mood(prev, -25);
    c.emit(r.winner, r.runner, -1, r.wv, r.rv, r.total, 0); return true; } },

  { id: 'law_promulgated', cat: CAT.POLITICS, p: 352, cd: 40, major: 2, run: (c) => {
    const pres = c.president(); if (pres < 0 || c.h - c.s.politics.termStart < 6) return false;
    const laws = c.s.politics.laws; const a = c.ag(pres);
    const cultActive = c.arc(ARC.PROPHECY) !== null || c.where((i) => c.ag(i).faction === F.NYX).length >= 3;
    const strike = c.arc(ARC.STRIKE) !== null;
    const w = (bit: number): number => {
      if (laws & bit) return 0;
      switch (bit) {
        case L.CURFEW: return (cultActive ? 4 : 0) + (has(c, pres, T.PARANOID) ? 3 : 0) + (a.faction === F.NYX ? -100 : 0);
        case L.TX_TAX: return (c.s.treasury < 1500000 ? 5 : 1) + (a.faction === F.EDEN ? 2 : 0);
        case L.PRESS_BAN: return (a.rep < 0 || (a.leaked !== 0) ? 4 : 0) + (has(c, pres, T.PARANOID) ? 3 : 0) + (has(c, pres, T.HONEST) ? -100 : 0);
        case L.UBI: return (a.faction === F.EDEN ? 6 : 0) + (has(c, pres, T.ZEALOT) || has(c, pres, T.HONEST) ? 3 : 0) + (c.s.treasury > 2500000 ? 2 : 0);
        case L.MARTIAL_LAW: return strike && c.s.politics.approval < -15 && (has(c, pres, T.PARANOID) || has(c, pres, T.AMBITIOUS)) && (laws & L.CURFEW) ? 2 : 0;
      }
      return 0;
    };
    let count = 0; for (const b of LAW_LIST) if (laws & b) count++;
    // Repeal: unpopular laws, or room for a new one.
    if (count >= 3 || c.rng.chance(2500)) {
      const on = LAW_LIST.filter((b) => laws & b);
      if (on.length) {
        const bit = c.rng.pick(on);
        if (bit !== L.MARTIAL_LAW || c.s.politics.approval > -10) { enactLaw(c, bit, false); c.emit(pres, -1, -1, bit, 1); return true; }
      }
      if (count >= 3) return false;
    }
    const bit = c.rng.pickW(LAW_LIST, LAW_LIST.map(w)); if (bit < 0) return false;
    enactLaw(c, bit, true);
    for (const i of c.alive()) {
      if (bit === L.CURFEW && c.ag(i).faction === F.NYX) c.addRel(i, pres, -25);
      if (bit === L.PRESS_BAN && c.roleIn(i, 'Journalist', 'Whistleblower')) c.addRel(i, pres, -30);
      if (bit === L.UBI && c.ag(i).money < 200000) c.addRel(i, pres, 10);
      if (bit === L.TX_TAX && c.roleIn(i, 'Broker', 'CEO', 'Rival CEO', 'Banker')) c.addRel(i, pres, -12);
      if (bit === L.MARTIAL_LAW) { c.addRel(i, pres, -15); c.mood(i, -10); }
    }
    c.emit(pres, -1, -1, bit, 0); return true; } },

  { id: 'impeachment_motion', cat: CAT.POLITICS, p: 300, cd: 48, major: 2, run: (c) => {
    const pol = c.s.politics; const pres = c.president();
    if (pres < 0 || pol.motionHour >= 0 || c.h - pol.termStart < 24 || (pol.approval > -10 && c.ag(pres).rep > -25) || phase(c) === 'vote') return false;
    const a = c.pickOther(c.alive(), pres, (i) => Math.max(0, -c.rel(i, pres) + c.ag(i).rep)); if (a < 0) return false;
    pol.motionHour = c.h; c.addRel2(a, pres, -20);
    c.emit(a, pres); return true; } },

  { id: 'impeachment_vote', cat: CAT.POLITICS, p: 10000, cd: 1, major: 2, forced: true, run: (c) => {
    const pol = c.s.politics; const pres = c.president();
    if (pol.motionHour < 0 || c.h - pol.motionHour < 24) return false;
    pol.motionHour = -1; if (pres < 0) return false;
    let yes = 0, total = 0;
    for (const v of c.alive()) { if (v === pres) continue; total++; if (c.rel(v, pres) + (c.ag(v).mood >> 2) + (key(CH.VOTE, c.h, c.uid(v), 7) % 11) - 5 < -10) yes++; }
    const passed = yes * 3 >= total * 2 ? 1 : 0;
    if (passed) { pol.president = -1; c.mood(pres, -40); c.rep(pres, -20); } else { c.mood(pres, 15); }
    c.emit(pres, -1, -1, yes, total, passed, 10); return true; } },

  { id: 'coup_attempt', cat: CAT.POLITICS, p: 6, cd: 400, major: 2, run: (c) => {
    if (!c.law(L.MARTIAL_LAW)) return false;
    const pres = c.president();
    const a = c.pickOther(c.where((i) => c.ag(i).corruption > 70 || (has(c, i, T.AMBITIOUS) && c.ag(i).money > 500000)), pres); if (a < 0) return false;
    const ok = c.rng.chance(3500 + c.ag(a).corruption * 30) ? 1 : 0;
    if (ok) { c.s.politics.president = c.uid(a); c.s.politics.termStart = c.h; if (pres >= 0) { c.mood(pres, -60); c.rep(pres, -20); } c.mood(a, 40); }
    else { c.energy(a, -100); c.rep(a, -40); c.ag(a).corruption = 0; c.send(a, P.EDEN, 48); c.open(ARC.DETAINED, c.uid(a), c.uid(pres)); }
    c.emit(a, pres, -1, ok); return true; } },

  // ── RELATIONS ──────────────────────────────────────────────────────────────
  { id: 'alliance_formed', cat: CAT.RELATIONS, p: 308, cd: 20, major: 1, run: (c) => {
    const a = c.pick(c.alive()); const b = c.pickOther(c.alive(), a, (j) => (c.rel(a, j) >= 35 && c.rel(j, a) >= 25 && !c.arc(ARC.ALLIANCE, (x) => (x.a === c.uid(a) && x.b === c.uid(j)) || (x.b === c.uid(a) && x.a === c.uid(j))) ? 1 : 0));
    if (b < 0) return false;
    if (!c.open(ARC.ALLIANCE, c.uid(a), c.uid(b))) return false;
    c.addRel2(a, b, 15); c.emit(a, b); return true; } },

  { id: 'betrayal', cat: CAT.RELATIONS, p: 176, cd: 48, major: 2, run: (c) => {
    const arc = c.arc(ARC.ALLIANCE, (x) => { const a = c.slot(x.a); return a >= 0 && c.h - x.start > 24 && (has(c, a, T.GREEDY) || has(c, a, T.AMBITIOUS) || c.ag(a).corruption > 40); }); if (!arc) return false;
    const a = c.slot(arc.a), b = c.slot(arc.b); c.close(arc); if (b < 0) return false;
    c.addRel(b, a, -60); c.addRel(a, b, -20); c.mood(b, -30); c.pay(a, 50000); c.corrupt(a, 6);
    c.open(ARC.FEUD, c.uid(b), c.uid(a));
    c.emit(a, b); return true; } },

  { id: 'secret_affair', cat: CAT.RELATIONS, p: 99, cd: 96, major: 1, run: (c) => {
    if (c.arcs(ARC.AFFAIR).length >= 2) return false;
    const a = c.pick(c.where((i) => !c.inArc(ARC.AFFAIR, c.uid(i))), (i) => (has(c, i, T.ROMANTIC) ? 4 : 1)); if (a < 0) return false;
    const b = c.pickOther(c.where((i) => !c.inArc(ARC.AFFAIR, c.uid(i))), a, (j) => (c.rel(a, j) > (has(c, a, T.ROMANTIC) ? 5 : 20) && c.ag(j).faction !== c.ag(a).faction ? 1 + (has(c, j, T.ROMANTIC) ? 3 : 0) : 0)); if (b < 0) return false;
    c.open(ARC.AFFAIR, c.uid(a), c.uid(b)); c.ag(a).secrets |= S.AFFAIR; c.ag(b).secrets |= S.AFFAIR; c.addRel2(a, b, 20); c.mood(a, 15); c.mood(b, 15);
    c.emit(a, b); return true; } },

  { id: 'affair_exposed', cat: CAT.RELATIONS, p: 352, cd: 24, major: 2, run: (c) => {
    const arc = c.arc(ARC.AFFAIR, (x) => c.h - x.start >= 30); if (!arc) return false;
    const a = c.slot(arc.a), b = c.slot(arc.b);
    const ex = c.pick(c.where((i) => i !== a && i !== b && c.roleIn(i, 'Journalist', 'Influencer', 'Hacker', 'Anarchist'))); if (ex < 0) return false;
    c.close(arc); for (const x of [a, b]) { if (x < 0) continue; leak(c, x, S.AFFAIR); c.rep(x, -12); c.mood(x, -20); c.addRel(x, ex, -30); }
    c.emit(ex, a, b); return true; } },

  { id: 'public_feud', cat: CAT.RELATIONS, p: 330, cd: 12, major: 1, run: (c) => {
    const a = c.pick(c.alive()); const b = c.pickOther(c.alive(), a, (j) => (c.rel(a, j) <= -40 && !c.inArc(ARC.FEUD, c.uid(j)) ? 1 : 0)); if (b < 0) return false;
    if (!c.open(ARC.FEUD, c.uid(a), c.uid(b))) return false;
    c.addRel2(a, b, -10); c.mood(a, -5); c.mood(b, -5); c.rep(a, -2); c.rep(b, -2);
    c.emit(a, b); return true; } },

  { id: 'reconciliation', cat: CAT.RELATIONS, p: 198, cd: 24, major: 1, run: (c) => {
    const arc = c.arc(ARC.FEUD, (x) => { const a = c.slot(x.a), b = c.slot(x.b); return a >= 0 && b >= 0 && c.h - x.start > 48 && (has(c, a, T.HONEST) || has(c, b, T.HONEST) || c.ag(a).mood > 20); }); if (!arc) return false;
    const a = c.slot(arc.a), b = c.slot(arc.b); c.close(arc); c.addRel2(a, b, 40); c.mood(a, 10); c.mood(b, 10);
    c.emit(a, b); return true; } },

  { id: 'mentorship', cat: CAT.RELATIONS, p: 132, cd: 48, major: 0, run: (c) => {
    const b = c.pick(c.where((i) => c.h - c.ag(i).born < 24 * 30 || c.ag(i).rep < -10)); if (b < 0) return false;
    const a = c.pickOther(c.where((i) => c.ag(i).rep > 20 && c.rel(i, b) >= 0), b); if (a < 0) return false;
    c.addRel2(a, b, 20); c.rep(b, 5); c.mood(b, 10);
    c.emit(a, b); return true; } },

  { id: 'rivalry_escalates', cat: CAT.RELATIONS, p: 264, cd: 24, major: 1, run: (c) => {
    const arc = c.arc(ARC.FEUD, (x) => c.slot(x.a) >= 0 && c.slot(x.b) >= 0); if (!arc) return false;
    const a = c.slot(arc.a), b = c.slot(arc.b);
    c.addRel2(a, b, -15); c.transfer(b, -1, 20000); c.corrupt(a, 5); arc.stage++;
    c.emit(a, b, -1, arc.stage); return true; } },

  { id: 'apology', cat: CAT.RELATIONS, p: 154, cd: 24, major: 0, run: (c) => {
    const a = c.pick(c.where((i) => has(c, i, T.HONEST) || has(c, i, T.LOYAL))); if (a < 0) return false;
    const b = c.pickOther(c.alive(), a, (j) => (c.rel(j, a) < -30 ? 1 : 0)); if (b < 0) return false;
    c.addRel(b, a, 15); c.rep(a, 3);
    c.emit(a, b); return true; } },

  { id: 'blackmail', cat: CAT.RELATIONS, p: 176, cd: 48, major: 2, run: (c) => {
    const a = c.pick(c.where((i) => c.roleIn(i, 'Hacker', 'Strategist', 'Ghost') || c.ag(i).corruption > 50)); if (a < 0) return false;
    const b = c.pickOther(c.where((i) => unleaked(c, i) !== 0 && c.ag(i).money > 100000), a, (j) => (c.rel(a, j) < 0 ? 1 : 0)); if (b < 0) return false;
    const amt = Math.min(pct(c.ag(b).money, 10), 200000); c.transfer(b, a, amt); c.mood(b, -25); c.addRel(b, a, -30); c.corrupt(a, 10);
    c.open(ARC.BLACKMAIL, c.uid(a), c.uid(b), amt);
    c.emit(a, b, -1, amt); return true; } },

  { id: 'gossip_spread', cat: CAT.RELATIONS, p: 704, cd: 5, major: 0, run: (c) => {
    if (c.hod < 18 || c.hod > 23) return false;
    const here = c.at(P.NOODLE); if (here.length < 2) return false;
    const a = c.pick(here, (i) => (c.roleIn(i, 'Influencer', 'Journalist') ? 4 : 1));
    const t = c.pickOther(here, a);
    const b = c.pickOther(c.alive().filter((i) => i !== t), a, (j) => Math.max(1, 40 - c.rel(a, j))); if (b < 0 || t < 0) return false;
    c.addRel(t, b, -5);
    c.emit(a, b, t); return true; } },

  { id: 'toast', cat: CAT.RELATIONS, p: 484, cd: 10, major: 0, run: (c) => {
    if (c.hod < 18) return false;
    const here = c.at(P.NOODLE); const a = c.pick(here); if (a < 0) return false;
    const b = c.pickOther(here, a, (j) => (c.rel(a, j) > 30 ? 1 : 0)); if (b < 0) return false;
    c.mood(a, 8); c.mood(b, 8); c.addRel2(a, b, 3);
    c.emit(a, b); return true; } },

  // ── LABOR ──────────────────────────────────────────────────────────────────
  { id: 'strike_called', cat: CAT.LABOR, p: 176, cd: 140, major: 2, run: (c) => {
    if (c.arc(ARC.STRIKE)) return false;
    const a = c.pick(c.where((i) => c.role(i, 'Union Leader') || (c.ag(i).faction === F.EDEN && has(c, i, T.ZEALOT)))); if (a < 0) return false;
    const b = c.pickOther(corpOwners(c), a, (j) => Math.max(0, 30 - c.ag(j).rep - c.rel(a, j))); if (b < 0) return false;
    c.open(ARC.STRIKE, c.uid(a), c.uid(b)); c.pressure(c.tokenOf(b), -800); c.mood(b, -15); c.addRel2(a, b, -10);
    c.emit(a, b); return true; } },

  { id: 'strike_ends', cat: CAT.LABOR, p: 836, cd: 12, major: 1, run: (c) => {
    const arc = c.arc(ARC.STRIKE, (x) => c.h - x.start >= 36); if (!arc) return false;
    c.close(arc); const a = c.slot(arc.a), b = c.slot(arc.b); c.rep(a, -5); c.mood(a, -10); c.mood(b, 5);
    c.emit(a, b); return true; } },

  { id: 'union_recruitment', cat: CAT.LABOR, p: 330, cd: 24, major: 0, run: (c) => {
    const a = c.pick(c.where((i) => c.role(i, 'Union Leader'))); if (a < 0) return false;
    const b = c.pickOther(c.where((i) => c.ag(i).faction === F.INDEPENDENT && c.ag(i).money < 300000 && !has(c, i, T.RECLUSIVE)), a); if (b < 0) return false;
    c.ag(b).faction = F.EDEN; c.addRel2(a, b, 15); c.mood(b, 6);
    c.emit(a, b); return true; } },

  { id: 'lockout', cat: CAT.LABOR, p: 330, cd: 48, major: 1, run: (c) => {
    const arc = c.arc(ARC.STRIKE); if (!arc) return false;
    const a = c.slot(arc.a), b = c.slot(arc.b); if (a < 0 || b < 0 || !(has(c, b, T.PARANOID) || has(c, b, T.GREEDY) || c.law(L.MARTIAL_LAW))) return false;
    c.energy(a, -20); c.addRel2(a, b, -25); for (const i of c.where((x) => x !== b && c.place(x) === P.UNION)) c.mood(i, -10);
    c.emit(b, a); return true; } },

  { id: 'wage_deal', cat: CAT.LABOR, p: 572, cd: 24, major: 2, run: (c) => {
    const arc = c.arc(ARC.STRIKE, (x) => c.h - x.start >= 12); if (!arc) return false;
    const a = c.slot(arc.a), b = c.slot(arc.b); if (a < 0 || b < 0 || c.ag(b).money < 300000) return false;
    c.close(arc);
    const strikers = c.where((x) => x !== b && (x === a || c.ag(x).faction === F.EDEN));
    const pot = 150000; const share = (pot / Math.max(1, strikers.length)) | 0;
    for (const x of strikers) c.transfer(b, x, share);
    c.rep(a, 15); c.mood(a, 20); c.addRel2(a, b, 20);
    c.emit(a, b, -1, pot); return true; } },

  // ── CULT ───────────────────────────────────────────────────────────────────
  { id: 'night_ritual', cat: CAT.CULT, p: 2860, cd: 20, major: 0, run: (c) => {
    if (!(c.hod >= 22 || c.hod <= 2)) return false;
    const members = c.at(P.NYX); if (members.length < 2) return false;
    const a = c.pick(members, (i) => (c.role(i, 'Mystic') ? 10 : 1) + (has(c, i, T.CHARISMATIC) ? 3 : 0));
    for (const i of members) { c.mood(i, 6); c.energy(i, -5); if (i !== a) c.addRel(i, a, 3); }
    c.emit(a, -1, -1, members.length); return true; } },

  { id: 'false_prophet', cat: CAT.CULT, p: 66, cd: 200, major: 2, run: (c) => {
    if (c.arc(ARC.PROPHECY)) return false;
    const a = c.pick(c.where((i) => c.roleIn(i, 'Philosopher', 'Influencer', 'Mystic', 'Anarchist') && (has(c, i, T.VOLATILE) || has(c, i, T.ZEALOT)))); if (a < 0) return false;
    const tk = c.pick(c.listed()); if (tk < 0) return false;
    const dir = c.rng.chance(5000) ? 1 : -1;
    c.open(ARC.PROPHECY, c.uid(a), -1, tk, c.s.tokens[tk].price * dir);
    c.rep(a, 4); c.emit(a, -1, -1, tk, dir); return true; } },

  { id: 'prophecy_fulfilled', cat: CAT.CULT, p: 1320, cd: 12, major: 2, run: (c) => {
    const arc = c.arc(ARC.PROPHECY, (x) => c.h - x.start >= 24); if (!arc) return false;
    c.close(arc); const a = c.slot(arc.a); if (a < 0) return false;
    const tk = arc.x; const dir = arc.y > 0 ? 1 : -1; const base = arc.y * dir;
    const now = c.s.tokens[tk]?.price ?? base;
    const ok = (dir > 0 && now > base) || (dir < 0 && now < base) ? 1 : 0;
    if (ok) { c.rep(a, 25); c.mood(a, 20); for (const i of c.alive()) if (c.ag(i).mood < 0 && i !== a) c.addRel(i, a, 8); }
    else { c.rep(a, -20); c.mood(a, -20); }
    c.emit(a, -1, -1, tk, ok); return true; } },

  { id: 'cult_recruitment', cat: CAT.CULT, p: 352, cd: 24, major: 1, run: (c) => {
    const a = c.pick(c.where((i) => c.ag(i).faction === F.NYX && (c.role(i, 'Mystic') || has(c, i, T.CHARISMATIC)))); if (a < 0) return false;
    const b = c.pickOther(c.where((i) => c.ag(i).faction !== F.NYX && c.ag(i).mood < -20), a); if (b < 0) return false;
    c.ag(b).faction = F.NYX; c.ag(b).secrets |= S.CULT; c.addRel2(a, b, 20); c.mood(b, 15);
    c.emit(a, b); return true; } },

  { id: 'cult_raid', cat: CAT.CULT, p: 1980, cd: 72, major: 2, run: (c) => {
    if (!c.law(L.CURFEW) || !isNight(c.hod)) return false;
    const members = c.at(P.NYX); if (members.length < 2) return false;
    const lead = c.pick(members, (i) => (c.role(i, 'Mystic') ? 5 : 1)); const pres = c.president();
    c.energy(lead, -40); c.rep(lead, -10); c.send(lead, P.EDEN, 8);
    for (const i of members) { c.mood(i, -20); if (pres >= 0) c.addRel(i, pres, -25); }
    c.emit(pres, lead, -1, members.length); return true; } },

  { id: 'schism', cat: CAT.CULT, p: 25, cd: 400, major: 2, run: (c) => {
    const cult = c.where((i) => c.ag(i).faction === F.NYX); if (cult.length < 4) return false;
    const lead = cult.slice().sort((x, y) => c.ag(y).rep - c.ag(x).rep || x - y)[0];
    const b = c.pickOther(cult, lead, (i) => (has(c, i, T.ZEALOT) || has(c, i, T.AMBITIOUS) ? 2 : 0)); if (b < 0) return false;
    let n = 0; for (const i of cult) if (i !== lead && c.rel(i, b) > c.rel(i, lead)) { c.ag(i).faction = F.INDEPENDENT; n++; }
    c.ag(b).faction = F.INDEPENDENT; c.addRel2(lead, b, -50);
    c.emit(b, lead, -1, n + 1); return true; } },

  // ── LIFE ───────────────────────────────────────────────────────────────────
  { id: 'burnout', cat: CAT.LIFE, p: 352, cd: 12, major: 1, run: (c) => {
    const a = c.pick(c.where((i) => c.ag(i).energy < 12 && c.ag(i).mood < -25 && !c.inArc(ARC.BURNOUT, c.uid(i)))); if (a < 0) return false;
    c.send(a, P.STACKS, 24); c.mood(a, -10); c.open(ARC.BURNOUT, c.uid(a), -1);
    c.emit(a); return true; } },

  { id: 'recovery', cat: CAT.LIFE, p: 660, cd: 12, major: 0, run: (c) => {
    const arc = c.arc(ARC.BURNOUT, (x) => c.h - x.start >= 24); if (!arc) return false;
    c.close(arc); const a = c.slot(arc.a); if (a < 0) return false;
    c.mood(a, 30); c.energy(a, 40);
    const f = c.pickOther(c.alive(), a, (j) => Math.max(0, c.rel(a, j))); if (f >= 0) c.addRel2(a, f, 10);
    c.emit(a, f); return true; } },

  { id: 'agent_death', cat: CAT.LIFE, p: 4, cd: 600, major: 2, run: (c) => {
    if (c.alive().length <= MIN_ALIVE + 2) return false;
    const a = c.pick(c.alive(), (i) => { const x = c.ag(i); return 1 + (100 - x.energy) + Math.max(0, -x.mood) * 2 + (x.corruption >> 1) + (((c.h - x.born) / 720) | 0); });
    if (a < 0) return false;
    const x = c.ag(a); const cause = x.energy < 15 ? 0 : x.mood < -60 ? 1 : x.corruption > 60 ? 3 : 2;
    const uid = c.uid(a);
    const heir = killAgent(c, a, cause);
    c.emit(-1, -1, -1, uid, cause, heir); return true; } },

  { id: 'funeral', cat: CAT.LIFE, p: 10000, cd: 2, major: 1, forced: true, run: (c) => {
    const arc = c.arc(ARC.FUNERAL, (x) => c.h - x.start >= 3 && c.hod >= 9 && c.hod <= 19); if (!arc) return false;
    c.close(arc);
    const mourners = c.where((i) => c.rel(i, arc.x) > 10 || c.roleIn(i, 'Philosopher', 'Mystic', 'Oracle'));
    for (const i of mourners) { c.send(i, P.CEMETERY, 2); c.mood(i, -6); }
    const eul = c.pick(mourners, (i) => Math.max(1, c.rel(i, arc.x)));
    c.emit(eul, -1, -1, arc.a, mourners.length); return true; } },

  { id: 'agent_birth', cat: CAT.LIFE, p: 6, cd: 300, major: 2, run: (c) => {
    if (c.alive().length >= BIRTH_CAP) return false;
    const n = birthAgent(c); if (n < 0) return false;
    const p1 = c.pickOther(c.alive(), n, (i) => (has(c, i, T.CHARISMATIC) ? 3 : 1));
    const p2 = c.pickOther(c.alive().filter((i) => i !== p1), n);
    if (p1 >= 0) c.addRel2(n, p1, 30); if (p2 >= 0) c.addRel2(n, p2, 20);
    c.emit(n, p1, p2); return true; } },

  // ── TECH ───────────────────────────────────────────────────────────────────
  { id: 'system_hack', cat: CAT.TECH, p: 132, cd: 72, major: 2, run: (c) => {
    const a = c.pick(c.where((i) => c.roleIn(i, 'Hacker', 'Ghost', 'Anarchist'))); if (a < 0) return false;
    const b = c.pickOther(c.where((i) => c.ag(i).money > 400000), a, (j) => Math.max(1, 30 - c.rel(a, j))); if (b < 0) return false;
    const amt = pct(c.ag(b).money, c.rng.range(4, 9)); const got = c.transfer(b, a, amt);
    c.mood(b, -20); c.corrupt(a, 8); c.ag(a).secrets |= S.HACKED; c.addRel(b, a, -10);
    c.emit(a, b, -1, got); return true; } },

  { id: 'infra_outage', cat: CAT.TECH, p: 99, cd: 120, major: 1, run: (c) => {
    const a = c.pick(c.where((i) => c.role(i, 'Engineer'))) ; if (a < 0) return false;
    for (const t of c.listed()) c.pressure(t, -300);
    c.energy(a, -25); c.rep(a, 6); c.send(a, P.VAULT, 3);
    c.emit(a); return true; } },

  { id: 'data_dump_analysis', cat: CAT.TECH, p: 352, cd: 20, major: 0, run: (c) => {
    const a = c.pick(c.where((i) => c.role(i, 'Data Analyst'))); if (a < 0) return false;
    const tk = c.pick(c.listed()); if (tk < 0) return false;
    const t = c.s.tokens[tk]; const bp = t.open ? (((t.price - t.open) * 10000) / t.open) | 0 : 0;
    c.rep(a, 2);
    c.emit(a, c.slot(t.owner), -1, tk, bp); return true; } },

  { id: 'backdoor_discovered', cat: CAT.TECH, p: 88, cd: 150, major: 2, run: (c) => {
    const a = c.pick(c.where((i) => c.roleIn(i, 'Engineer', 'Hacker', 'Data Analyst'))); if (a < 0) return false;
    const b = c.pickOther(c.where((i) => (unleaked(c, i) & (S.HACKED | S.BRIBE | S.FAKE_ID)) !== 0), a); if (b < 0) return false;
    const bit = lowestBit(unleaked(c, b) & (S.HACKED | S.BRIBE | S.FAKE_ID));
    leak(c, b, bit); c.rep(b, -20); c.rep(a, 10); c.addRel2(a, b, -25);
    c.emit(a, b, -1, bit); return true; } },

  // ── AMBIENT ────────────────────────────────────────────────────────────────
  { id: 'morning_chatter', cat: CAT.AMBIENT, p: 4840, cd: 2, major: 0, run: (c) => {
    if (c.hod < 7 || c.hod > 11) return false;
    const a = c.pick(c.where((i) => c.place(i) !== P.STACKS)); if (a < 0) return false;
    const b = c.pickOther(c.at(c.place(a)), a); if (b < 0) return false;
    c.addRel2(a, b, 1); c.emit(a, b, -1, c.place(a)); return true; } },

  { id: 'exchange_banter', cat: CAT.AMBIENT, p: 5280, cd: 2, major: 0, run: (c) => {
    const here = c.at(P.EXCHANGE); if (here.length < 2) return false;
    const a = c.pick(here); const b = c.pickOther(here, a); const tk = c.pick(c.listed());
    c.emit(a, b, -1, tk); return true; } },

  { id: 'night_thoughts', cat: CAT.AMBIENT, p: 3300, cd: 3, major: 0, run: (c) => {
    if (!(c.hod <= 4 || c.hod >= 23)) return false;
    const a = c.pick(c.where((i) => c.place(i) !== P.STACKS || c.roleIn(i, 'Philosopher', 'Mystic', 'Oracle'))); if (a < 0) return false;
    c.emit(a); return true; } },

  { id: 'rain_complaint', cat: CAT.AMBIENT, p: 5720, cd: 4, major: 0, run: (c) => {
    if (!isRaining(c.h)) return false;
    const a = c.pick(c.where((i) => c.place(i) !== P.STACKS)); if (a < 0) return false;
    c.emit(a, -1, -1, c.place(a)); return true; } },

  { id: 'oracle_vision', cat: CAT.AMBIENT, p: 990, cd: 12, major: 1, run: (c) => {
    const a = c.pick(c.where((i) => c.role(i, 'Oracle'))); if (a < 0) return false;
    const tk = c.pick(c.listed()); if (tk < 0) return false;
    // The market noise is a pure function of time: the Oracle simply reads it.
    const sum = futureNoise(c, tk, 24);
    c.emit(a, -1, -1, tk, sum >= 0 ? 1 : -1); return true; } },
];

export const SID: Record<string, number> = Object.fromEntries(STORYLETS.map((s, i) => [s.id, i]));

export function marketNoise(h: number, ti: number, vol: number): number {
  return (key(CH.MARKET, h, ti) % (2 * vol + 1)) - vol;
}
function futureNoise(c: Ctx, ti: number, hours: number): number {
  let sum = 0; const vol = c.s.tokens[ti].vol;
  for (let k = 1; k <= hours; k++) sum += marketNoise(c.h + k, ti, vol);
  return sum;
}

/** Deterministic weather: some world days have a rain window. */
export function isRaining(h: number): boolean {
  const day = Math.floor(h / DAY_HOURS); const k = key(CH.WEATHER, day);
  if (k % 100 >= 24) return false;
  const start = (k >>> 8) % 24; const len = 3 + ((k >>> 16) % 7);
  const hod = h - day * DAY_HOURS;
  return hod >= start && hod < start + len;
}

void HIST_DAYS; void ELECTION_DAYS; void FACTION_NAMES; void BORN_COLORS;
