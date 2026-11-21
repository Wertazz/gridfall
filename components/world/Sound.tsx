'use client';

import { useEffect, useRef, useState } from 'react';
import type { View } from '@/lib/world/engine';
import { ARC } from '@/lib/sim/state';
import { darknessAt } from '@/lib/render/renderer';

type Rig = { ctx: AudioContext; hum: GainNode; siren: GainNode; sirenOsc: OscillatorNode; lfo: OscillatorNode };

function build(): Rig {
  const ctx = new AudioContext();
  const master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
  // City hum: two detuned saws through a low-pass.
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170;
  const hum = ctx.createGain(); hum.gain.value = 0.05; lp.connect(hum); hum.connect(master);
  for (const f of [55, 55.6, 82.4]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const g = ctx.createGain(); g.gain.value = 0.33; o.connect(g); g.connect(lp); o.start(); }
  // Distant traffic: filtered noise.
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 400; nf.Q.value = 0.6;
  const ng = ctx.createGain(); ng.gain.value = 0.012; noise.connect(nf); nf.connect(ng); ng.connect(hum); noise.start();
  // Siren (crises only).
  const siren = ctx.createGain(); siren.gain.value = 0; siren.connect(master);
  const sirenOsc = ctx.createOscillator(); sirenOsc.type = 'triangle'; sirenOsc.frequency.value = 720;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.45; const lfoG = ctx.createGain(); lfoG.gain.value = 180;
  lfo.connect(lfoG); lfoG.connect(sirenOsc.frequency); sirenOsc.connect(siren); sirenOsc.start(); lfo.start();
  return { ctx, hum, siren, sirenOsc, lfo };
}

/** Optional ambience, muted by default. */
export default function Sound({ view }: { view: View | null }) {
  const [on, setOn] = useState(false);
  const rig = useRef<Rig | null>(null);

  useEffect(() => {
    const r = rig.current; if (!r || !view) return;
    const crisis = view.cur.arcs.some((a) => a.type === ARC.BANKRUN || (a.type === ARC.CRASH && view.H - a.start < 3));
    const t = r.ctx.currentTime;
    r.siren.gain.setTargetAtTime(on && crisis ? 0.018 : 0, t, 0.6);
    r.hum.gain.setTargetAtTime(on ? 0.035 + darknessAt(view.minuteOfDay) * 0.03 : 0, t, 0.8);
  }, [view, on]);

  useEffect(() => () => { void rig.current?.ctx.close(); }, []);

  return (
    <button
      onClick={() => { if (!rig.current) rig.current = build(); void rig.current.ctx.resume(); setOn((v) => !v); }}
      className="text-[#6b7280] hover:text-[#e8e6f0] text-[12px] px-1"
      aria-label={on ? 'Mute city sound' : 'Play city sound'} title={on ? 'Mute' : 'Sound (off by default)'}
    >{on ? '🔊' : '🔇'}</button>
  );
}
