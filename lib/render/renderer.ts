// Canvas 2D renderer: integer zoom, integer translation → pixel-perfect.
import { MAP_W, MAP_H, TILE, PLACES_GEO, GRAVE_SPOTS, LAMPS } from '../micro/map';
import { drawStatic, WINDOWS, NEON_SPOTS } from './tiles';
import { sprite, eyeSprite, POSE, SPRITE_W, SPRITE_H } from './sprites';
import { pixelText } from './font';
import { mix } from '../sim/prng';
import { P, TOKEN_NAMES } from '../sim/roster';
import { ARC, type WorldState } from '../sim/state';
import { graveProfile, type Profile } from '../sim/profile';
import type { Pose } from '../micro/positions';

export const WORLD_PX_W = MAP_W * TILE;
export const WORLD_PX_H = MAP_H * TILE;

type Canvas = HTMLCanvasElement | OffscreenCanvas;
function makeCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

/** Darkness by minute of day (0..1440) → alpha 0..0.66, piecewise linear, integers in /1000. */
const DARK = (() => {
  const pts: Array<[number, number]> = [[0, 660], [300, 660], [420, 120], [480, 0], [1080, 0], [1200, 380], [1320, 660], [1440, 660]];
  const out = new Int16Array(1440);
  for (let m = 0; m < 1440; m++) {
    let k = 0; while (pts[k + 1][0] <= m) k++;
    const [m0, v0] = pts[k], [m1, v1] = pts[k + 1];
    out[m] = v0 + Math.trunc(((v1 - v0) * (m - m0)) / (m1 - m0));
  }
  return out;
})();
export const darknessAt = (minuteOfDay: number) => DARK[((minuteOfDay % 1440) + 1440) % 1440] / 1000;

export type Bubble = { uid: number; text: string; color: string; age: number; major: number };
export type Eye = { x: number; y: number }; // world px
export type Frame = {
  tw: number; H: number; minuteOfDay: number;
  cur: WorldState; poses: Pose[]; profiles: Map<number, Profile>;
  bubbles: Bubble[]; eyes: Eye[];
  selected: number; raining: boolean; oracle: number; // 0 = off, else glitch strength
  font: string;
};

export class Camera {
  x = WORLD_PX_W / 2; y = WORLD_PX_H / 2; z = 2;
  minZ = 1; maxZ = 8;
  fit(w: number, h: number, dpr: number) {
    this.minZ = Math.max(1, Math.floor(Math.min(w / WORLD_PX_W, h / WORLD_PX_H)));
    this.maxZ = Math.max(this.minZ + 2, Math.round(8 * Math.max(1, dpr / 1.5)));
    this.z = Math.min(this.maxZ, Math.max(this.minZ, this.z));
  }
  clamp(w: number, h: number) {
    const vw = w / this.z, vh = h / this.z;
    const pad = 48;
    this.x = vw >= WORLD_PX_W ? WORLD_PX_W / 2 : Math.min(WORLD_PX_W - vw / 2 + pad, Math.max(vw / 2 - pad, this.x));
    this.y = vh >= WORLD_PX_H ? WORLD_PX_H / 2 : Math.min(WORLD_PX_H - vh / 2 + pad, Math.max(vh / 2 - pad, this.y));
  }
  offset(w: number, h: number) {
    return { ox: Math.round(w / 2 - this.x * this.z), oy: Math.round(h / 2 - this.y * this.z) };
  }
  toWorld(sx: number, sy: number, w: number, h: number) {
    const { ox, oy } = this.offset(w, h);
    return { x: (sx - ox) / this.z, y: (sy - oy) / this.z };
  }
}

export class Renderer {
  ctx: CanvasRenderingContext2D;
  cam = new Camera();
  private stat: Canvas;
  private lights: Canvas;
  private lightsHour = -1;
  private glows = new Map<string, Canvas>();
  w = 0; h = 0; dpr = 1;

  constructor(public canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.stat = makeCanvas(WORLD_PX_W, WORLD_PX_H);
    drawStatic(this.stat.getContext('2d') as CanvasRenderingContext2D);
    this.lights = makeCanvas(WORLD_PX_W, WORLD_PX_H);
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.dpr = dpr; this.w = Math.round(cssW * dpr); this.h = Math.round(cssH * dpr);
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.cam.fit(this.w, this.h, dpr); this.cam.clamp(this.w, this.h);
  }

  private glow(color: string): Canvas {
    let g = this.glows.get(color); if (g) return g;
    g = makeCanvas(64, 64); const c = g.getContext('2d') as CanvasRenderingContext2D;
    const grd = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, color + 'aa'); grd.addColorStop(0.35, color + '44'); grd.addColorStop(1, color + '00');
    c.fillStyle = grd; c.fillRect(0, 0, 64, 64);
    this.glows.set(color, g); return g;
  }

  private updateLights(H: number, hod: number) {
    if (H === this.lightsHour) return;
    this.lightsHour = H;
    const c = this.lights.getContext('2d') as CanvasRenderingContext2D;
    c.clearRect(0, 0, WORLD_PX_W, WORLD_PX_H);
    const pct = hod >= 18 && hod <= 23 ? 62 : hod <= 1 ? 45 : hod <= 5 ? 14 : hod <= 8 ? 35 : 20;
    for (const w of WINDOWS) {
      if (mix(w.seed ^ Math.imul(H, 2654435761)) % 100 >= pct) continue;
      const warm = (w.seed >>> 5) % 4;
      c.fillStyle = ['#fde68a', '#fbcfe8', '#bae6fd', '#ddd6fe'][warm];
      c.fillRect(w.x, w.y, w.w, w.h);
    }
  }

  draw(f: Frame) {
    const { ctx, cam } = this;
    const W = this.w, Hh = this.h, z = cam.z;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, W, Hh);

    const off = cam.offset(W, Hh); const oy = off.oy; let ox = off.ox;
    if (f.oracle) { const j = mix(f.tw >> 7) % 7; ox += (j - 3) * f.oracle; }
    ctx.setTransform(z, 0, 0, z, ox, oy);
    ctx.drawImage(this.stat as CanvasImageSource, 0, 0);

    this.drawProps(f);

    // Agents, sorted by y.
    const talking = new Set(f.bubbles.filter((b) => b.age < 1).map((b) => b.uid));
    for (const p of f.poses) {
      const pr = f.profiles.get(p.uid); if (!pr) continue;
      const wx = (p.x >> 4) - (SPRITE_W >> 1) + ((mix(p.uid) % 5) - 2), wy = (p.y >> 4) - SPRITE_H + 4;
      if (p.uid === f.selected) {
        ctx.fillStyle = pr.color; ctx.globalAlpha = 0.5 + 0.3 * ((f.tw >> 9) % 2);
        ctx.fillRect(wx - 1, wy + SPRITE_H - 2, SPRITE_W + 2, 2); ctx.globalAlpha = 1;
      }
      let pose: number = POSE.IDLE;
      if (p.dying) pose = POSE.FALL;
      else if (p.moving) pose = [POSE.WALK1, POSE.IDLE, POSE.WALK2, POSE.IDLE][(f.tw >> 10) % 4];
      else if (talking.has(p.uid)) pose = (f.tw >> 11) % 2 ? POSE.TALK : POSE.IDLE;
      else if (p.newborn && (f.tw >> 11) % 3 === 0) pose = POSE.CHEER;
      ctx.drawImage(sprite(pr.shape, pr.color, pr.skin, p.dir, pose) as CanvasImageSource, wx, wy);
    }

    // Night.
    const dark = darknessAt(f.minuteOfDay);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (dark > 0) { ctx.fillStyle = `rgba(6,4,22,${dark})`; ctx.fillRect(0, 0, W, Hh); }

    // Lights.
    ctx.setTransform(z, 0, 0, z, ox, oy);
    ctx.globalCompositeOperation = 'lighter';
    const hod = Math.floor(f.minuteOfDay / 60);
    if (dark > 0.05) {
      this.updateLights(f.H, hod);
      ctx.globalAlpha = Math.min(1, dark * 1.4);
      ctx.drawImage(this.lights as CanvasImageSource, 0, 0);
      ctx.globalAlpha = Math.min(1, 0.25 + dark);
      for (const l of LAMPS) { const g = this.glow('#fde68a'); ctx.drawImage(g as CanvasImageSource, l.x * TILE - 16, l.y * TILE - 20, 48, 48); }
    }
    ctx.globalAlpha = 0.35 + dark * 0.8;
    for (const n of NEON_SPOTS) ctx.drawImage(this.glow(n.color) as CanvasImageSource, n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    // Bank run alarm.
    if (f.cur.arcs.some((a) => a.type === ARC.BANKRUN) && (f.tw >> 9) % 2 === 0) {
      const v = PLACES_GEO[P.VAULT].building!;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(this.glow('#ff2244') as CanvasImageSource, v.x * TILE + (v.w * TILE) / 2 - 60, v.y * TILE - 30, 120, 120);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // Rain (screen space, deterministic in time).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (f.raining) {
      ctx.strokeStyle = 'rgba(160,180,255,0.28)'; ctx.lineWidth = Math.max(1, this.dpr);
      ctx.beginPath();
      const n = Math.floor((W * Hh) / 9000);
      for (let k = 0; k < n; k++) {
        const s = mix(k * 2654435761);
        const sp = 900 + (s % 600);
        const x = ((s >>> 3) % W + (f.tw / 40) % W) % W;
        const y = ((s >>> 13) % Hh + (f.tw * sp) / 12000) % Hh;
        ctx.moveTo(x, y); ctx.lineTo(x - 3 * this.dpr, y + 10 * this.dpr);
      }
      ctx.stroke();
    }

    this.drawEyes(f, ox, oy);
    this.drawBubbles(f, ox, oy);
    this.drawLabels(ox, oy);
    if (f.oracle) this.glitch(f);
  }

  private drawProps(f: Frame) {
    const ctx = this.ctx;
    // Exchange ticker screen.
    const ex = PLACES_GEO[P.EXCHANGE].building!;
    const sx = ex.x * TILE + 6, sy = ex.y * TILE + 8, sw = ex.w * TILE - 12;
    const listed = f.cur.tokens.filter((t) => t.listed);
    const scroll = Math.floor(f.tw / 2500) % Math.max(1, listed.length);
    for (let row = 0; row < Math.min(6, listed.length); row++) {
      const t = listed[(row + scroll) % listed.length];
      const up = t.price >= t.open;
      const pctv = t.open ? Math.round(((t.price - t.open) * 1000) / t.open) / 10 : 0;
      const y = sy + 3 + row * 8;
      pixelText(ctx, TOKEN_NAMES[t.name].slice(1, 5), sx + 2, y, '#e8e6f0');
      pixelText(ctx, `${up ? '+' : ''}${pctv.toFixed(1)}`, sx + sw - 26, y, up ? '#34d399' : '#f87171');
    }
    // Headstones.
    const first = f.cur.deaths - f.cur.graves.length;
    f.cur.graves.forEach((g, k) => {
      const spot = GRAVE_SPOTS[(first + k) % GRAVE_SPOTS.length];
      const pr = graveProfile(g);
      const x = spot.x * TILE + 3, y = spot.y * TILE + 1;
      ctx.fillStyle = '#3b3b4a'; ctx.fillRect(x, y + 2, 10, 12); ctx.fillRect(x + 1, y, 8, 2);
      ctx.fillStyle = '#4b4b5e'; ctx.fillRect(x + 1, y + 2, 8, 1);
      ctx.fillStyle = pr.color; ctx.fillRect(x + 4, y + 4, 2, 5); ctx.fillRect(x + 2, y + 5, 6, 2);
      ctx.fillStyle = '#1e1e28'; ctx.fillRect(x, y + 13, 10, 1);
    });
  }

  private drawEyes(f: Frame, ox: number, oy: number) {
    if (!f.eyes.length) return;
    const ctx = this.ctx; const z = this.cam.z; const s = Math.max(1, Math.floor(z / 2));
    const img = eyeSprite() as CanvasImageSource;
    for (const e of f.eyes) {
      const bob = ((f.tw >> 9) + Math.floor(e.x)) % 4 < 2 ? 0 : 1;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(img, Math.round(ox + e.x * z - 4 * s), Math.round(oy + (e.y - 28 - bob) * z), 9 * s, 5 * s);
    }
    ctx.globalAlpha = 1;
  }

  private drawBubbles(f: Frame, ox: number, oy: number) {
    const ctx = this.ctx; const z = this.cam.z; const d = this.dpr;
    const size = Math.round(Math.max(9, Math.min(13, 4 + z * 1.3)) * d);
    ctx.font = `${size}px ${f.font}`; ctx.textBaseline = 'top';
    const pos = new Map(f.poses.map((p) => [p.uid, p]));
    const maxW = Math.min(260 * d, this.w * 0.6);
    const placed: Array<{ x: number; y: number; w: number; h: number }> = [];
    const sorted = f.bubbles.slice().sort((a, b) => b.major - a.major || a.age - b.age);
    for (const b of sorted) {
      const p = pos.get(b.uid); if (!p) continue;
      if (z < 2 && b.major < 1) continue;
      const lines = wrap(ctx, b.text, maxW);
      const lh = size * 1.25; const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14 * d; const bh = lines.length * lh + 10 * d;
      const bx = Math.round(ox + (p.x / 16) * z - bw / 2); let by = Math.round(oy + (p.y / 16) * z - (SPRITE_H + 6) * z - bh);
      for (let tries = 0; tries < 6; tries++) { const hit = placed.find((r) => bx < r.x + r.w && bx + bw > r.x && by < r.y + r.h && by + bh > r.y); if (!hit) break; by = hit.y - bh - 4 * d; }
      if (bx + bw < 0 || bx > this.w || by + bh < 0 || by > this.h) continue;
      placed.push({ x: bx, y: by, w: bw, h: bh });
      const fade = b.age > 0.85 ? (1 - b.age) / 0.15 : 1;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = 'rgba(10,10,15,0.92)'; ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = b.color; ctx.fillRect(bx, by, 2 * d, bh);
      ctx.fillRect(Math.round(ox + (p.x / 16) * z) - 2 * d, by + bh, 4 * d, 4 * d);
      ctx.fillStyle = b.major >= 2 ? '#ffffff' : '#d6d3e6';
      lines.forEach((l, k) => ctx.fillText(l, bx + 8 * d, by + 5 * d + k * lh));
      ctx.globalAlpha = 1;
    }
  }

  private drawLabels(ox: number, oy: number) {
    const z = this.cam.z; if (z < 3) return;
    const ctx = this.ctx; const d = this.dpr;
    ctx.font = `bold ${Math.round(9 * d)}px monospace`; ctx.textBaseline = 'top';
    for (const p of PLACES_GEO) {
      const bx = p.building ? p.building.x + p.building.w / 2 : p.area.x + p.area.w / 2;
      const by = p.building ? p.building.y + p.building.h : p.area.y;
      const text = p.name.toUpperCase(); const tw = ctx.measureText(text).width;
      const x = Math.round(ox + bx * TILE * z - tw / 2), y = Math.round(oy + by * TILE * z - (p.building ? 0 : 14 * d));
      ctx.fillStyle = 'rgba(5,5,8,0.7)'; ctx.fillRect(x - 4 * d, y - 2 * d, tw + 8 * d, 13 * d);
      ctx.fillStyle = p.color; ctx.fillText(text, x, y);
    }
  }

  private glitch(f: Frame) {
    const ctx = this.ctx; const W = this.w, H = this.h; const s = f.oracle;
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.45;
    ctx.drawImage(this.canvas, 3 * s, 0); ctx.drawImage(this.canvas, -3 * s, 0);
    ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(190,140,255,0.9)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    const slices = 4 + (mix(f.tw >> 8) % 5);
    for (let k = 0; k < slices; k++) {
      const r = mix((f.tw >> 8) * 31 + k); const y = r % H; const h = 2 + ((r >>> 8) % 18) * this.dpr; const dx = ((r >>> 16) % 40) - 20;
      ctx.drawImage(this.canvas, 0, y, W, h, dx * s, y, W, h);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += 3 * this.dpr) ctx.fillRect(0, y, W, this.dpr);
  }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' '); const lines: string[] = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    if (lines.length >= 4) break;
  }
  if (cur && lines.length < 4) lines.push(cur);
  return lines;
}
