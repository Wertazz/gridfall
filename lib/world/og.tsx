// OpenGraph card for a moment of the world (rendered by next/og, free on Vercel).
import { ImageResponse } from 'next/og';
import type { Moment } from './moment';
import { profileOf, type Profile } from '../sim/profile';
import { placeOf, slotOfUid } from '../sim/routine';
import { PLACE_NAMES } from '../sim/roster';

export const OG_SIZE = { width: 1200, height: 630 };

function Avatar({ p, scale = 7 }: { p: Profile; scale?: number }) {
  const skin = ['#f1c9a5', '#d9a37c', '#a86f4c', '#6f4630', '#e8d5c4'][p.skin % 5];
  const r = (x: number, y: number, w: number, h: number, c: string) => (
    <div style={{ position: 'absolute', left: x * scale, top: y * scale, width: w * scale, height: h * scale, backgroundColor: c }} />
  );
  return (
    <div style={{ position: 'relative', width: 12 * scale, height: 16 * scale, display: 'flex' }}>
      {r(3, 12, 2, 3, '#16161f')}{r(7, 12, 2, 3, '#16161f')}
      {r(2, 7, 8, 6, p.color)}{r(1, 8, 1, 4, p.color)}{r(10, 8, 1, 4, p.color)}
      {r(3, 1, 6, 6, skin)}{r(3, 1, 6, 2, '#1c1c26')}
      {r(4, 4, 1, 1, '#0a0a0f')}{r(7, 4, 1, 1, '#0a0a0f')}
      {r(2, 15, 8, 1, 'rgba(0,0,0,0.5)')}
    </div>
  );
}

function clock(minute: number) {
  const m = minute % 1440;
  return `DAY ${Math.floor(minute / 1440) + 1} — ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function momentImage(m: Moment | null, focus?: string | null) {
  const s = m?.state;
  const ev = m?.event ?? null;
  const speakerUid = ev ? (ev.a >= 0 ? ev.a : ev.b) : -1;
  let speaker = s && speakerUid >= 0 ? profileOf(s, speakerUid) : null;
  if (s && focus) { const f = s.agents.find((a) => a.uid >= 0 && profileOf(s, a.uid).handle === focus); if (f) speaker = profileOf(s, f.uid); }
  let place = -1;
  const crowd: Profile[] = [];
  if (s && speaker) {
    const slot = slotOfUid(s, speaker.uid);
    if (slot >= 0) {
      place = placeOf(s, slot, s.hour - 1);
      for (let i = 0; i < s.agents.length; i++) if (s.agents[i].alive && i !== slot && placeOf(s, i, s.hour - 1) === place) crowd.push(profileOf(s, s.agents[i].uid));
    }
  }
  const title = m?.text?.title ?? 'THE GRID never sleeps.';
  const quote = m?.text ? (m.text.a?.text ?? m.text.b?.text ?? m.text.sys ?? '') : 'A city of autonomous agents, computed from the clock.';

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: '#0a0a0f', color: '#e8e6f0', padding: 56, fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 26, letterSpacing: 8, color: '#c084fc' }}>
          GRIDFALL
          <span style={{ marginLeft: 24, fontSize: 22, letterSpacing: 2, color: '#9ca3af' }}>{m ? clock(m.minute) : ''}</span>
          <span style={{ marginLeft: 'auto', fontSize: 18, letterSpacing: 2, color: '#4b5563' }}>{m ? `WORLD STATE #${m.hash.slice(0, 8)}` : ''}</span>
        </div>
        <div style={{ display: 'flex', marginTop: 40, fontSize: 52, fontWeight: 700, lineHeight: 1.15, maxWidth: 1080 }}>{title}</div>
        {quote && (
          <div style={{ display: 'flex', marginTop: 28, fontSize: 28, color: '#c8c5d8', borderLeft: `6px solid ${speaker?.color ?? '#c084fc'}`, paddingLeft: 20, maxWidth: 1000 }}>
            {speaker ? `@${speaker.handle}: ` : ''}{quote.length > 140 ? quote.slice(0, 137) + '…' : quote}
          </div>
        )}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 230, display: 'flex', alignItems: 'flex-end', opacity: 0.55 }}>
          {[[90, '#2b1f4a', '#c084fc'], [150, '#3a1620', '#f43f5e'], [70, '#1d3326', '#4ade80'], [200, '#1b2a48', '#60a5fa'], [110, '#3a3112', '#fbbf24'], [60, '#331528', '#f472b6'], [170, '#1f2438', '#a5b4fc'], [120, '#3b2512', '#fb923c'], [80, '#24402f', '#34d399'], [140, '#2b1f4a', '#c084fc']].map(([h, c, n], i) => (
            <div key={i} style={{ display: 'flex', width: 120, height: Number(h), backgroundColor: String(c), borderTop: `4px solid ${n}`, marginRight: 0 }} />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 'auto', gap: 20 }}>
          {speaker && <Avatar p={speaker} scale={9} />}
          {crowd.slice(0, 6).map((p) => <Avatar key={p.uid} p={p} scale={6} />)}
          <div style={{ display: 'flex', flexDirection: 'column', marginLeft: 'auto', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 20, color: '#6b7280' }}>{place >= 0 ? PLACE_NAMES[place].toUpperCase() : 'THE GRID'}</span>
            <span style={{ fontSize: 18, color: '#4b5563', marginTop: 6 }}>Everyone sees this exact moment. gridfall.xyz</span>
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
