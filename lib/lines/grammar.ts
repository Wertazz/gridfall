// Procedural language: assemble corpus fragments with state-filled slots. No LLM at runtime.
import STORY from '../../data/lines/storylets.json';
import VOICES from '../../data/lines/voices.json';
import BORN from '../../data/lines/born.json';
import CHATTER from '../../data/lines/chatter.json';
import { Rng, CH, key } from '../sim/prng';
import { STORYLETS } from '../sim/storylets';
import { TOKEN_NAMES, LAW_NAMES, LAW_LIST, PLACE_NAMES, SECRET_NAMES, FOUNDERS, N_MAX_EXPORT } from './refs';
import { profileOf } from '../sim/profile';
import type { WorldState, WorldEvent } from '../sim/state';

type SL = {
  params: string[]; ra: string; rb: string; title: string[];
  titleRepeal?: string[]; a?: string[]; aRepeal?: string[]; aFail?: string[]; draft?: string[]; b?: string[]; sys?: string[];
};
const S = STORY as unknown as Record<string, SL>;
const V = VOICES as unknown as Record<string, Record<string, string[]>>;
const BV = BORN.voice as unknown as Record<string, string[]>;
const BR = BORN.roles as unknown as Record<string, Record<string, string[]>>;

export type Said = { uid: number; text: string };
export type EventText = { title: string; a: Said | null; b: Said | null; sys: string | null; major: number; cat: number };

const CAUSES = ['exhaustion', 'despair', 'disconnection', 'corruption'];

export function money(cents: number): string {
  const d = Math.round(Math.abs(cents) / 100);
  return `${cents < 0 ? '-' : ''}$${d.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}
export function pct(bp: number): string { const v = Math.round(bp / 10) / 10; return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; }
function secretName(bit: number): string { for (let b = 0; b < 8; b++) if (bit === 1 << b) return SECRET_NAMES[b]; return 'has something to hide'; }

function voiceFor(s: WorldState, uid: number): (reg: string) => string[] {
  const p = profileOf(s, uid);
  const founder = p.founder ? V[p.handle] : null;
  const roleTics = BR[p.role];
  return (reg) => (founder && founder[reg]) || (roleTics && roleTics[reg]) || BV[reg] || [];
}

function relExtreme(s: WorldState, uid: number, sign: 1 | -1): string {
  let slot = -1; for (let i = 0; i < s.agents.length; i++) if (s.agents[i].uid === uid && s.agents[i].alive) slot = i;
  if (slot < 0) return sign > 0 ? 'my friends' : 'my enemies';
  let best = -1, bv = sign > 0 ? -999 : 999;
  for (let j = 0; j < s.agents.length; j++) {
    if (j === slot || !s.agents[j].alive) continue;
    const v = s.rel[slot * N_MAX_EXPORT + j];
    if ((sign > 0 && v > bv) || (sign < 0 && v < bv)) { bv = v; best = j; }
  }
  return best < 0 ? 'nobody' : profileOf(s, s.agents[best].uid).name;
}

type Ctx = { s: WorldState; ev: WorldEvent | null; rng: Rng; speaker: number; vars: Record<string, string> };

function slot(c: Ctx, name: string): string {
  if (name in c.vars) return c.vars[name];
  const s = c.s;
  switch (name) {
    case 'rival': return relExtreme(s, c.speaker, -1);
    case 'ally': return relExtreme(s, c.speaker, 1);
    case 'president': return s.politics.president >= 0 ? profileOf(s, s.politics.president).name : 'the Interim';
    case 'law': { const on = LAW_LIST.filter((b) => s.politics.laws & b); return on.length ? LAW_NAMES[c.rng.pick(on)] : 'Night Curfew'; }
    case 'token': { const l = s.tokens.filter((t) => t.listed); return l.length ? TOKEN_NAMES[c.rng.pick(l).name] : '$GRID'; }
    case 'B': return relExtreme(s, c.speaker, -1);
    case 'place': return 'the city';
    case 'day': return String(Math.floor(s.hour / 24) + 1);
  }
  return name;
}

function expand(tpl: string, c: Ctx, depth = 0): string {
  let out = tpl.replace(/\[([^\]]*\|[^\]]*)\]/g, (_, alts: string) => c.rng.pick(alts.split('|')));
  if (depth < 2) {
    const voice = voiceFor(c.s, c.speaker);
    out = out.replace(/#(\w+)#/g, (_, reg: string) => { const list = voice(reg); return list.length ? expand(c.rng.pick(list), c, depth + 1) : ''; });
  } else out = out.replace(/#(\w+)#/g, '');
  out = out.replace(/\{(\w+)\}/g, (_, n: string) => slot(c, n));
  out = out.replace(/\s+/g, ' ').replace(/\s+([.,!?])/g, '$1').trim();
  return out;
}

function eventVars(s: WorldState, ev: WorldEvent, spec: SL): Record<string, string> {
  const v: Record<string, string> = {};
  const name = (u: number) => (u < 0 ? 'SYSTEM' : profileOf(s, u).name);
  if (ev.a >= 0) v.A = name(ev.a);
  if (ev.b >= 0) v.B = name(ev.b);
  if (ev.c >= 0) v.C = name(ev.c);
  const ps = [ev.p0, ev.p1, ev.p2];
  spec.params.forEach((t, i) => {
    const p = ps[i];
    switch (t) {
      case 'token': v.token = TOKEN_NAMES[s.tokens[p]?.name ?? 5] ?? '$GRID'; break;
      case 'token2': v.token2 = TOKEN_NAMES[s.tokens[p]?.name ?? 5] ?? '$GRID'; break;
      case 'bp': v.bp = pct(p); break;
      case 'cents': v.cents = money(p); break;
      case 'secret': v.secret = secretName(p); break;
      case 'law': v.law = LAW_NAMES[p] ?? 'law'; break;
      case 'place': v.place = PLACE_NAMES[p] ?? 'the city'; break;
      case 'votes': v.votes = String(p); break;
      case 'votes2': v.votes2 = String(p); break;
      case 'total': v.total = String(p); break;
      case 'count': v.count = String(p); break;
      case 'stage': v.stage = String(p + 1); break;
      case 'dir': v.dir = p > 0 ? 'rise' : 'fall'; break;
      case 'uid': v.dead = name(p); break;
      case 'cause': v.cause = (CAUSES[p] ?? 'unknown').toUpperCase(); break;
      case 'heir': v.heir = p >= 0 ? name(p) : 'THE TREASURY'; break;
    }
  });
  if (ev.a >= 0) { const pa = profileOf(s, ev.a); v.role = pa.role.toUpperCase(); }
  if (!v.B && ev.c >= 0) v.B = name(ev.c);
  return v;
}

const cache = new Map<number, EventText>();

export function eventText(s: WorldState, ev: WorldEvent): EventText {
  const hit = cache.get(ev.seq); if (hit) return hit;
  const st = STORYLETS[ev.sid]; const spec = S[st.id];
  const rng = new Rng(key(CH.LINE, ev.seq, ev.sid));
  const vars = eventVars(s, ev, spec);
  const c: Ctx = { s, ev, rng, speaker: ev.a, vars };
  const flagIdx = spec.params.findIndex((t) => t === 'ok' || t === 'repeal' || t === 'drafted' || t === 'forced');
  const flag = flagIdx >= 0 ? [ev.p0, ev.p1, ev.p2][flagIdx] : 0;
  // impeachment_vote stores passed in p2
  const passed = st.id === 'impeachment_vote' ? ev.p2 : flag;

  let titles = spec.title;
  if (st.id === 'law_promulgated' && flag && spec.titleRepeal) titles = spec.titleRepeal;
  let title: string;
  if (['impeachment_vote', 'coup_attempt', 'prophecy_fulfilled'].includes(st.id)) title = expand(titles[passed ? 0 : 1] ?? titles[0], c);
  else title = expand(rng.pick(titles), c);

  let aLines = spec.a;
  if (st.id === 'law_promulgated' && flag && spec.aRepeal) aLines = spec.aRepeal;
  if (st.id === 'candidacy_declared' && flag && spec.draft) aLines = spec.draft;
  if ((st.id === 'coup_attempt' || st.id === 'prophecy_fulfilled') && !flag && spec.aFail) aLines = spec.aFail;
  if (st.id === 'impeachment_vote' && spec.a) aLines = [spec.a[passed ? 0 : 1]];

  let a: Said | null = null, b: Said | null = null, sys: string | null = null;
  if (ev.a >= 0 && aLines && aLines.length) {
    const voice = voiceFor(s, ev.a)(spec.ra);
    const useVoice = voice.length > 0 && st.major < 2 && rng.chance(3000);
    a = { uid: ev.a, text: expand(useVoice ? rng.pick(voice) : rng.pick(aLines), c) };
  }
  if (ev.b >= 0 && spec.b && spec.b.length && rng.chance(7000)) {
    const cb: Ctx = { s, ev, rng, speaker: ev.b, vars: { ...vars, B: vars.A ?? 'you' } };
    b = { uid: ev.b, text: expand(rng.pick(spec.b), cb) };
  }
  if (spec.sys && (ev.a < 0 || st.major === 2)) sys = expand(rng.pick(spec.sys), c);
  const out: EventText = { title, a, b, sys, major: st.major, cat: st.cat };
  cache.set(ev.seq, out);
  if (cache.size > 2000) cache.delete(cache.keys().next().value as number);
  return out;
}

// ── Ambient chatter (display only, deterministic in time) ───────────────────
const CH_PLACES = CHATTER.places as Record<string, string[]>;
export function chatterLine(s: WorldState, uid: number, place: number, window: number, night: boolean): string {
  const rng = new Rng(key(CH.CHAT, uid, window, place));
  const c: Ctx = { s, ev: null, rng, speaker: uid, vars: { place: PLACE_NAMES[place] } };
  const pool = CH_PLACES[PLACE_NAMES[place]] ?? [];
  if (pool.length && rng.chance(5500)) return expand(rng.pick(pool), c);
  return expand(`#${night ? 'night' : 'calm'}#`, c) || expand(rng.pick(pool), c);
}

export function eyesLine(s: WorldState, uid: number, place: number, n: number, window: number, localtime: string | null): string {
  const rng = new Rng(key(CH.EYES, uid, window));
  const c: Ctx = { s, ev: null, rng, speaker: uid, vars: { place: PLACE_NAMES[place], n: String(n), localtime: localtime ?? '' } };
  if (localtime && rng.chance(1500)) return expand(rng.pick(CHATTER.clock), c);
  return expand(rng.pick(CHATTER.eyes), c);
}

void FOUNDERS;
