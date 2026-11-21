// Which speech bubbles are on screen at world time tw. Display only.
import { key, CH } from '../sim/prng';
import { STORYLETS } from '../sim/storylets';
import { eventText, chatterLine } from './grammar';
import type { View } from '../world/engine';
import type { Bubble } from '../render/renderer';
import { darknessAt } from '../render/renderer';
import { corrupt } from './glitch';

const EVENT_SPAN = 5;   // world minutes a line stays up (25 real s)
const REPLY_DELAY = 1.5;
const CHAT_WINDOW = 3;
const chatCache = new Map<string, string>();
function chatText(v: View, uid: number, place: number, w: number, night: boolean) {
  const k = `${v.cur.hour}|${uid}|${place}|${w}|${night ? 1 : 0}`;
  let t = chatCache.get(k);
  if (t === undefined) { t = chatterLine(v.cur, uid, place, w, night); chatCache.set(k, t); if (chatCache.size > 400) chatCache.delete(chatCache.keys().next().value as string); }
  return t;
}

export function computeBubbles(v: View, extra: Bubble[] = [], glitch = 0): Bubble[] {
  const now = v.tw / 60_000;
  const out: Bubble[] = [];
  const alive = new Set(v.poses.map((p) => p.uid));
  for (const e of v.cur.log) {
    const start = e.hour * 60 + e.minute;
    if (start > now || now - start > EVENT_SPAN + REPLY_DELAY) continue;
    const t = eventText(v.cur, e);
    const color = (uid: number) => v.profiles.get(uid)?.color ?? '#9ca3af';
    if (t.a && alive.has(t.a.uid) && now - start <= EVENT_SPAN) out.push({ uid: t.a.uid, text: t.a.text, color: color(t.a.uid), age: (now - start) / EVENT_SPAN, major: STORYLETS[e.sid].major });
    if (t.b && alive.has(t.b.uid) && now - start >= REPLY_DELAY) out.push({ uid: t.b.uid, text: t.b.text, color: color(t.b.uid), age: (now - start - REPLY_DELAY) / EVENT_SPAN, major: Math.max(0, STORYLETS[e.sid].major - 1) });
  }
  // Ambient chatter: one random present agent per busy place per window.
  const busy = new Set(out.map((b) => b.uid));
  const byPlace = new Map<number, number[]>();
  for (const p of v.poses) if (!p.dying) { const l = byPlace.get(p.place) ?? []; l.push(p.uid); byPlace.set(p.place, l); }
  const night = darknessAt(v.minuteOfDay) > 0.4;
  for (const [place, uids] of Array.from(byPlace.entries())) {
    for (const w of [Math.floor(now / CHAT_WINDOW), Math.floor(now / CHAT_WINDOW) - 1]) {
      const k = key(CH.CHAT, place, w);
      const odds = uids.length >= 2 ? 72 : 30;
      if (k % 100 >= odds) continue;
      const start = w * CHAT_WINDOW + ((k >>> 8) % 100) / 100;
      const age = (now - start) / CHAT_WINDOW;
      if (age < 0 || age >= 1) continue;
      const uid = uids.slice().sort((a, b) => a - b)[(k >>> 16) % uids.length];
      if (busy.has(uid)) continue;
      busy.add(uid);
      out.push({ uid, text: chatText(v, uid, place, w, night), color: v.profiles.get(uid)?.color ?? '#9ca3af', age, major: -1 });
    }
  }
  const all = out.concat(extra);
  if (glitch > 0) for (const b of all) b.text = corrupt(b.text, b.uid * 977 + Math.floor(now), glitch);
  return all;
}
