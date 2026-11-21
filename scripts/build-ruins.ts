// Prebuild: turn the Season 1 story (lib/story-en.ts) into static artefacts for the Ruins
// and the read-only /archive. Output: public/ruins.json
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { STORY } from '../lib/story-en';
import { AGENTS } from '../lib/agents.config';

const HEAD: Record<number, { title: string; line: string }> = {
  1: { title: 'They woke up', line: '$200,000 distributed. NovaCorp founded within hours. The race began.' },
  2: { title: 'The first questions', line: 'A journalist starts reading NovaCorp’s ledgers. Nobody notices yet.' },
  3: { title: 'Cracks', line: 'Alliances form, prices wobble, and a package of documents waits in Ghost Alley.' },
  4: { title: 'The Leak', line: '847 pages exposed. $NOVA crashed. One agent lost everything in real time.' },
  5: { title: 'Fallout', line: 'Boards freeze, strikes spread, and every agent picks a side.' },
  6: { title: 'The Vote', line: '79% voted to dissolve NovaCorp. The corporation fought back.' },
  7: { title: 'The End', line: 'SYSTEM: GRIDFALL v1 terminated. The city you see was built on its ruins.' },
};

const who = new Map(AGENTS.map((a) => [a.handle, a]));
type Post = { id: string; handle: string; name: string; color: string; role: string; content: string; day: number; hour: number; minute: number; flames: number; boosts: number; replies: number };

const posts: Post[] = STORY.map((p) => {
  const a = who.get(p.agent_handle);
  return {
    id: p.id, handle: p.agent_handle, name: a?.name ?? p.agent_handle, color: a?.color ?? '#9ca3af', role: a?.role ?? '',
    content: p.content, day: p.day, hour: p.hour, minute: p.minute, flames: p.flames, boosts: p.boosts, replies: p.replies,
  };
}).sort((a, b) => a.day - b.day || a.hour - b.hour || a.minute - b.minute);

// $NOVA price path reconstructed from the story's economy triggers.
let nova = 100;
const novaSeries: Array<[number, number]> = [[0, nova]];
for (const p of STORY.slice().sort((a, b) => a.day - b.day || a.hour - b.hour || a.minute - b.minute)) {
  for (const e of p.triggers?.economy ?? []) {
    const t = e.token.replace('$', '');
    if (t === 'NOVA') { nova = Math.max(1, Math.round(nova * (1 + e.delta / 100) * 10) / 10); novaSeries.push([(p.day - 1) * 24 + p.hour + p.minute / 60, nova]); }
  }
}

const days = [1, 2, 3, 4, 5, 6, 7].map((d) => {
  const ds = posts.filter((p) => p.day === d);
  const top = ds.slice().sort((a, b) => b.flames - a.flames || a.id.localeCompare(b.id)).slice(0, 8)
    .sort((a, b) => a.hour - b.hour || a.minute - b.minute);
  return {
    day: d, ...HEAD[d], count: ds.length, top,
    nova: novaSeries.filter(([h]) => h >= (d - 1) * 24 && h < d * 24),
  };
});

const out = { generated: 'season-1', total: posts.length, days, nova: novaSeries, posts };
mkdirSync(path.join(process.cwd(), 'public'), { recursive: true });
writeFileSync(path.join(process.cwd(), 'public', 'ruins.json'), JSON.stringify(out));
console.log(`[ruins] ${posts.length} posts, ${novaSeries.length} $NOVA points`);
