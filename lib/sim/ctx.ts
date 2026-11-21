// Mutation helpers used by storylets and the step function. Integers only.
import { N_MAX, MONEY_MAX, MEM_SIZE, LOG_SIZE, MAX_ARCS, MAX_TOKENS } from './config';
import { Rng, CH, key } from './prng';
import { R, T, L, PLACE_COUNT } from './roster';
import { placeOf, hourOfDay, weekDay, dayOf, slotOfUid } from './routine';
import type { WorldState, Arc } from './state';

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export class Ctx {
  readonly h: number; readonly hod: number; readonly wd: number; readonly day: number;
  rng: Rng;
  sid = 0;
  private aliveCache: number[] | null = null;

  constructor(public s: WorldState) {
    this.h = s.hour; this.hod = hourOfDay(s.hour); this.wd = weekDay(s.hour); this.day = dayOf(s.hour);
    this.rng = new Rng(key(CH.STORY, this.h, 0));
  }

  /** Re-seed the local stream for storylet `sid`. */
  begin(sid: number) { this.sid = sid; this.rng = new Rng(key(CH.STORY, this.h, sid + 1)); }

  // ── Agents ───────────────────────────────────────────────────────────────
  alive(): number[] {
    if (!this.aliveCache) {
      const out: number[] = [];
      for (let i = 0; i < this.s.agents.length; i++) if (this.s.agents[i].alive) out.push(i);
      this.aliveCache = out;
    }
    return this.aliveCache;
  }
  dirty() { this.aliveCache = null; }
  ag(i: number) { return this.s.agents[i]; }
  uid(i: number) { return i < 0 ? -1 : this.s.agents[i].uid; }
  slot(uid: number) { return slotOfUid(this.s, uid); }
  role(i: number, name: string) { return this.s.agents[i].role === R[name]; }
  roleIn(i: number, ...names: string[]) { const r = this.s.agents[i].role; for (const n of names) if (R[n] === r) return true; return false; }
  trait(i: number, t: number) { return (this.s.agents[i].traits & t) !== 0; }
  where(pred: (i: number) => boolean): number[] { return this.alive().filter(pred); }
  place(i: number) { return placeOf(this.s, i, this.h); }
  at(place: number): number[] { return this.where((i) => this.place(i) === place); }

  /** Weighted pick of a slot; weight fn returns a non-negative int. -1 if none. */
  pick(cands: number[], w?: (i: number) => number): number {
    if (cands.length === 0) return -1;
    if (!w) return cands[this.rng.int(cands.length)];
    return this.rng.pickW(cands, cands.map(w));
  }
  pickOther(cands: number[], not: number, w?: (i: number) => number): number {
    return this.pick(cands.filter((i) => i !== not), w);
  }

  // ── Relations & stats ────────────────────────────────────────────────────
  rel(i: number, j: number) { return this.s.rel[i * N_MAX + j]; }
  addRel(i: number, j: number, d: number) {
    if (i === j || i < 0 || j < 0) return;
    const k = i * N_MAX + j;
    this.s.rel[k] = clamp(this.s.rel[k] + d, -100, 100);
  }
  addRel2(i: number, j: number, d: number) { this.addRel(i, j, d); this.addRel(j, i, d); }
  mood(i: number, d: number) { if (i >= 0) this.s.agents[i].mood = clamp(this.s.agents[i].mood + d, -100, 100); }
  energy(i: number, d: number) { if (i >= 0) this.s.agents[i].energy = clamp(this.s.agents[i].energy + d, 0, 100); }
  rep(i: number, d: number) { if (i >= 0) this.s.agents[i].rep = clamp(this.s.agents[i].rep + d, -100, 100); }
  corrupt(i: number, d: number) { if (i >= 0) this.s.agents[i].corruption = clamp(this.s.agents[i].corruption + d, 0, 100); }

  // ── Money (cents) ────────────────────────────────────────────────────────
  pay(i: number, amt: number) { const a = this.s.agents[i]; a.money = clamp(a.money + Math.max(0, amt | 0), 0, MONEY_MAX); }
  take(i: number, amt: number): number {
    const a = this.s.agents[i]; const t = clamp(amt | 0, 0, a.money); a.money -= t; return t;
  }
  /** Transfer with the transaction tax if in force. Returns the amount received. */
  transfer(from: number, to: number, amt: number): number {
    const t = this.take(from, amt);
    let tax = 0;
    if (this.law(L.TX_TAX)) { tax = (t * 2) / 100 | 0; this.s.treasury = clamp(this.s.treasury + tax, 0, MONEY_MAX); }
    if (to >= 0) this.pay(to, t - tax); else this.s.treasury = clamp(this.s.treasury + t - tax, 0, MONEY_MAX);
    return t - tax;
  }
  netWorth(i: number): number {
    let v = this.s.agents[i].money;
    for (let t = 0; t < this.s.tokens.length; t++) if (this.s.tokens[t].listed) v += this.s.holdings[i * MAX_TOKENS + t] * this.s.tokens[t].price;
    return clamp(v, 0, MONEY_MAX);
  }

  // ── Tokens ───────────────────────────────────────────────────────────────
  listed(): number[] { const o: number[] = []; this.s.tokens.forEach((t, i) => { if (t.listed) o.push(i); }); return o; }
  pressure(ti: number, bp: number) { if (ti >= 0 && ti < this.s.tokens.length) this.s.tokens[ti].pressure = clamp(this.s.tokens[ti].pressure + bp, -6000, 6000); }
  tokenOf(i: number): number { const u = this.uid(i); for (let t = 0; t < this.s.tokens.length; t++) if (this.s.tokens[t].listed && this.s.tokens[t].owner === u) return t; return -1; }
  holding(i: number, t: number) { return this.s.holdings[i * MAX_TOKENS + t]; }
  addHolding(i: number, t: number, d: number) { const k = i * MAX_TOKENS + t; this.s.holdings[k] = Math.max(0, this.s.holdings[k] + d); }

  // ── Laws & politics ──────────────────────────────────────────────────────
  law(bit: number) { return (this.s.politics.laws & bit) !== 0; }
  president(): number { return this.slot(this.s.politics.president); }

  // ── Arcs ─────────────────────────────────────────────────────────────────
  arc(type: number, pred?: (a: Arc) => boolean): Arc | null {
    for (const a of this.s.arcs) if (a.type === type && (!pred || pred(a))) return a;
    return null;
  }
  arcs(type: number): Arc[] { return this.s.arcs.filter((a) => a.type === type); }
  inArc(type: number, uid: number) { return this.arc(type, (a) => a.a === uid || a.b === uid) !== null; }
  open(type: number, a: number, b: number, x = 0, y = 0): Arc | null {
    if (this.s.arcs.length >= MAX_ARCS) return null;
    const arc = { type, a, b, x, y, start: this.h, stage: 0 };
    this.s.arcs.push(arc);
    return arc;
  }
  close(arc: Arc) { const k = this.s.arcs.indexOf(arc); if (k >= 0) this.s.arcs.splice(k, 1); }

  // ── Places ───────────────────────────────────────────────────────────────
  send(i: number, place: number, hours: number) {
    if (i < 0 || place < 0 || place >= PLACE_COUNT) return;
    const a = this.s.agents[i]; a.override = place; a.overrideUntil = this.h + hours;
  }

  // ── Events ───────────────────────────────────────────────────────────────
  emit(a: number, b = -1, c = -1, p0 = 0, p1 = 0, p2 = 0, minute = -1): number {
    const s = this.s;
    const seq = s.seq++;
    const ev = {
      seq, hour: this.h, minute: minute >= 0 ? minute : this.rng.int(55),
      sid: this.sid, a: this.uid(a), b: this.uid(b), c: this.uid(c), p0, p1, p2,
    };
    s.log.push(ev);
    if (s.log.length > LOG_SIZE) s.log.shift();
    for (const x of [a, b, c]) {
      if (x < 0) continue;
      const m = s.agents[x].mem; m.shift(); m.push(seq);
      if (m.length > MEM_SIZE) m.shift();
    }
    return seq;
  }

  traitsOf(i: number) { return this.s.agents[i].traits; }
  has(i: number, t: keyof typeof T) { return (this.s.agents[i].traits & T[t]) !== 0; }
}
