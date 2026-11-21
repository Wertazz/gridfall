// Prebuild: simulate from Genesis to (build time + YEARS) and write one checkpoint per real day.
// Output: public/checkpoints/<k>.bin (int32 LE), index.json, markers.json (historic events).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { genesisState, stepHour } from '../lib/sim/step';
import { serialize } from '../lib/sim/state';
import { CHECKPOINT_HOURS, GENESIS_MS, HOUR_MS } from '../lib/sim/config';
import { STORYLETS, SID } from '../lib/sim/storylets';

const HISTORIC = new Set(['election_result', 'agent_death', 'agent_birth', 'coup_attempt', 'impeachment_vote', 'hostile_takeover', 'schism', 'token_launch', 'token_delisting', 'bank_run', 'market_crash'].map((id) => SID[id]));

const YEARS = Number(process.env.CHECKPOINT_YEARS ?? 3);
const out = path.join(process.cwd(), 'public', 'checkpoints');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const nowHour = Math.max(0, Math.floor((Date.now() - GENESIS_MS) / HOUR_MS));
const endHour = nowHour + Math.ceil((YEARS * 365 * 24 * 3600 * 1000) / HOUR_MS);
const count = Math.floor(endHour / CHECKPOINT_HOURS) + 1;

const s = genesisState();
const markers: number[][] = []; // [hour, minute, sid, a, b, p0]
let lastSeq = 0;
const t0 = Date.now();
for (let k = 1; k < count; k++) {
  const target = k * CHECKPOINT_HOURS;
  while (s.hour < target) {
    stepHour(s);
    for (const e of s.log) if (e.seq >= lastSeq && HISTORIC.has(e.sid) && !(STORYLETS[e.sid].id === 'impeachment_vote' && e.p2 === 0)) markers.push([e.hour, e.minute, e.sid, e.a, e.b, e.p0]);
    lastSeq = s.seq;
  }
  const words = serialize(s);
  const buf = Buffer.alloc(words.length * 4);
  for (let i = 0; i < words.length; i++) buf.writeInt32LE(words[i], i * 4);
  writeFileSync(path.join(out, `${k}.bin`), buf);
}
writeFileSync(path.join(out, 'index.json'), JSON.stringify({ count, every: CHECKPOINT_HOURS, genesis: GENESIS_MS, version: 1 }));
writeFileSync(path.join(out, 'markers.json'), JSON.stringify(markers));
console.log(`[checkpoints] ${count - 1} files up to world hour ${endHour} (${markers.length} markers) in ${Date.now() - t0} ms`);
