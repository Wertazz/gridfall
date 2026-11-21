// One macro step = one world hour. state(T) = replay of steps from Genesis.
import { MINUTE_MS, GENESIS_MS, HOUR_MINUTES, MONEY_MAX, MIN_ALIVE, MAX_STORYLETS_PER_HOUR, N_MAX, MAX_TOKENS, HIST_DAYS } from './config';
import { ROLES, P, L, R } from './roster';
import { CH, key, Rng } from './prng';
import { Ctx } from './ctx';
import { STORYLETS, SID, marketNoise, birthAgent, approval } from './storylets';
import { ARC, initialState, type WorldState } from './state';

const ARC_TTL: Record<number, number> = {
  [ARC.SCANDAL]: 140, [ARC.ALLIANCE]: 480, [ARC.AFFAIR]: 260, [ARC.FEUD]: 260, [ARC.STRIKE]: 96,
  [ARC.CRASH]: 48, [ARC.BANKRUN]: 30, [ARC.PROPHECY]: 72, [ARC.BLACKMAIL]: 120, [ARC.FUNERAL]: 30,
  [ARC.BURNOUT]: 60, [ARC.DEFIANCE]: 48, [ARC.DETAINED]: 48,
};

export function genesisState(): WorldState { return initialState(STORYLETS.length); }

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function stepHour(s: WorldState): void {
  const c = new Ctx(s);
  const h = c.h, hod = c.hod;

  // 1. Bodies: energy follows where the routine puts each agent.
  for (const i of c.alive()) {
    const a = s.agents[i];
    const pl = c.place(i);
    if (pl === P.STACKS && (hod >= 22 || hod <= 6)) a.energy = clamp(a.energy + 8, 0, 100);
    else if (pl === P.STACKS) a.energy = clamp(a.energy + 2, 0, 100);
    else a.energy = clamp(a.energy - 2, 0, 100);
    if (a.energy < 20 && h % 2 === 0) a.mood = clamp(a.mood - 1, -100, 100);
    if (h % 12 === 0) a.mood += a.mood > 0 ? -1 : a.mood < 0 ? 1 : 0;
    if (h % 12 === 0) a.rep += a.rep > 0 ? -1 : a.rep < 0 ? 1 : 0;
    if (a.override >= 0 && a.overrideUntil <= h) a.override = -1;
  }

  // 2. Market.
  for (let t = 0; t < s.tokens.length; t++) {
    const tk = s.tokens[t];
    if (!tk.listed) continue;
    const noise = marketNoise(h, t, tk.vol);
    const revert = (((tk.anchor - tk.price) * 100) / Math.max(1, tk.anchor)) | 0; // bp, mean reversion
    const delta = clamp(noise + tk.pressure + revert, -4000, 4000);
    tk.price = clamp(tk.price + (((tk.price * delta) / 10000) | 0), 1, 10_000_000);
    tk.pressure = (tk.pressure * 6 / 10) | 0;
  }
  // Traders trade at the Exchange.
  if (hod >= 8 && hod <= 18) {
    for (const i of c.alive()) {
      if (!c.roleIn(i, 'Broker', 'Banker', 'Data Analyst') || c.place(i) !== P.EXCHANGE) continue;
      const r = new Rng(key(CH.MARKET, h, 1000 + s.agents[i].uid));
      if (!r.chance(3000)) continue;
      const listed = c.listed(); if (!listed.length) continue;
      const t = r.pick(listed); const tk = s.tokens[t]; const q = r.range(1, 12);
      if (tk.price >= tk.open) { // momentum: buy
        const cost = tk.price * q; if (s.agents[i].money > cost * 2) { c.transfer(i, -1, cost); c.addHolding(i, t, q); }
      } else if (c.holding(i, t) >= q) { c.addHolding(i, t, -q); c.pay(i, tk.price * q); }
    }
  }

  // 3. Daily accounting at midnight.
  if (hod === 0) {
    for (const i of c.alive()) {
      const a = s.agents[i];
      let income = ROLES[a.role].income;
      const own = c.tokenOf(i); if (own >= 0) income += s.tokens[own].price * 3;
      let upkeep = 5000 + (a.money > 2_000_000 ? ((a.money - 2_000_000) / 200) | 0 : 0);
      if (c.law(L.UBI) && s.treasury > 6000) { s.treasury -= 6000; income += 6000; }
      if (c.law(L.MARTIAL_LAW)) upkeep += 2000;
      a.money = clamp(a.money + income - upkeep, 0, MONEY_MAX);
      s.treasury = clamp(s.treasury + ((upkeep / 4) | 0), 0, MONEY_MAX);
      if (a.money === 0) a.mood = clamp(a.mood - 10, -100, 100);
      if (a.corruption > 0 && c.day % 2 === 0) a.corruption--;
    }
    for (const tk of s.tokens) tk.open = tk.price;
    s.politics.approval = approval(c);
    // Relations slowly drift back toward neutral.
    if (c.day % 2 === 0) for (let k = 0; k < N_MAX * N_MAX; k++) { const v = s.rel[k]; s.rel[k] = v > 0 ? v - 1 : v < 0 ? v + 1 : 0; }
    // New political cycle.
    if (c.wd === 0) s.politics.candidates = [];
  }

  // 4. Arcs expire.
  s.arcs = s.arcs.filter((a) => h - a.start < (ARC_TTL[a.type] ?? 96));

  // 5. Storylets: scheduled ones first, then a seeded rotation over the rest.
  for (let k = 0; k < STORYLETS.length; k++) {
    const st = STORYLETS[k];
    if (!st.forced || h - s.cooldowns[k] < st.cd) continue;
    c.begin(k);
    if (st.run(c)) s.cooldowns[k] = h;
  }
  // Draft: if nobody runs, SYSTEM drafts the two most reputed agents.
  if (c.wd === 1 && hod === 22 && s.politics.candidates.length < 2) {
    c.begin(SID['candidacy_declared']);
    const pool = c.alive().filter((i) => !s.politics.candidates.includes(s.agents[i].uid))
      .sort((x, y) => s.agents[y].rep - s.agents[x].rep || s.agents[x].uid - s.agents[y].uid);
    for (const i of pool) { if (s.politics.candidates.length >= 2) break; s.politics.candidates.push(s.agents[i].uid); c.emit(i, -1, -1, 1); }
  }
  let fired = 0;
  const n = STORYLETS.length;
  const start = key(CH.ORDER, h) % n;
  for (let k = 0; k < n && fired < MAX_STORYLETS_PER_HOUR; k++) {
    const idx = (start + k) % n;
    const st = STORYLETS[idx];
    if (st.forced || h - s.cooldowns[idx] < st.cd) continue;
    c.begin(idx);
    if (!c.rng.chance(st.p)) continue;
    if (st.run(c)) { s.cooldowns[idx] = h; fired++; }
  }

  // 6. Guards.
  if (c.alive().length < MIN_ALIVE) {
    c.begin(SID['agent_birth']);
    const nb = birthAgent(c);
    if (nb >= 0) { s.cooldowns[SID['agent_birth']] = h; c.emit(nb, -1, -1, 1); }
  }
  if (s.politics.president >= 0 && c.slot(s.politics.president) < 0) s.politics.president = -1;

  // 7. End of day: fortune history.
  if (hod === 23) {
    for (const i of c.alive()) { const a = s.agents[i]; a.hist.shift(); a.hist.push(c.netWorth(i)); if (a.hist.length > HIST_DAYS) a.hist.shift(); }
  }

  s.hour = h + 1;
}

export function replay(s: WorldState, toHour: number): WorldState {
  while (s.hour < toHour) stepHour(s);
  return s;
}

// ── Time helpers ────────────────────────────────────────────────────────────
export function worldMinuteAt(tMs: number): number { return Math.floor((tMs - GENESIS_MS) / MINUTE_MS); }
/** The macro state that is "current" at world minute m has hour = floor(m/60)+1. */
export function hourForMinute(m: number): number { return Math.floor(m / HOUR_MINUTES) + 1; }

void R; void MAX_TOKENS;
