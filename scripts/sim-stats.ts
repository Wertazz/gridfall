// Quick narrative health report: npx tsx scripts/sim-stats.ts [days]
import { genesisState, stepHour } from '../lib/sim/step';
import { STORYLETS } from '../lib/sim/storylets';
import { stateHash } from '../lib/sim/state';

const days = Number(process.argv[2] ?? 60);
const s = genesisState();
const counts = new Array(STORYLETS.length).fill(0);
let lastSeq = 0;
const t0 = performance.now();
for (let h = 0; h < days * 24; h++) {
  stepHour(s);
  for (const e of s.log) if (e.seq >= lastSeq) counts[e.sid]++;
  lastSeq = s.seq;
}
const ms = performance.now() - t0;
console.log(`${days} world days in ${ms.toFixed(0)} ms — events ${s.seq} (${(s.seq / (days * 24)).toFixed(2)}/h) hash ${stateHash(s)}`);
console.log('alive', s.agents.filter((a) => a.alive).length, 'deaths', s.deaths, 'births', s.births, 'elections', s.politics.elections, 'president', s.politics.president, 'laws', s.politics.laws, 'treasury', s.treasury);
console.log('tokens', s.tokens.map((t) => `${t.name}:${t.price}${t.listed ? '' : 'x'}`).join(' '));
console.log('money', s.agents.filter((a) => a.alive).map((a) => `${a.uid}:${(a.money / 100) | 0}`).join(' '));
console.log('mood', s.agents.filter((a) => a.alive).map((a) => `${a.mood}/${a.energy}/${a.rep}`).join(' '));
const zero = STORYLETS.filter((_, i) => counts[i] === 0).map((x) => x.id);
console.log('never fired:', zero.join(', ') || 'none');
console.log(STORYLETS.map((x, i) => `${x.id}=${counts[i]}`).join(' '));
