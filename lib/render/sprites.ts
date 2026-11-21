// Procedural agent sprites: 12×16 px, one silhouette per role shape, tinted by agent color.
// Frames are rendered once into small canvases and cached.

export const SPRITE_W = 12;
export const SPRITE_H = 16;
export const POSE = { WALK0: 0, WALK1: 1, WALK2: 2, IDLE: 3, TALK: 4, CHEER: 5, FALL: 6 } as const;

type Canvas = HTMLCanvasElement | OffscreenCanvas;
const cache = new Map<string, Canvas>();

function makeCanvas(w: number, h: number): Canvas {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const SKIN = ['#f1c9a5', '#d9a37c', '#a86f4c', '#6f4630', '#e8d5c4'];

/**
 * shape: role silhouette (0 suit, 1 press, 2 robe, 3 trader, 4 hood, 5 sash, 6 visor, 7 glasses, 8 star, 9 mohawk)
 * dir: 0 down, 1 left, 2 right, 3 up
 */
export function sprite(shape: number, color: string, skin: number, dir: number, pose: number): Canvas {
  const k = `${shape}|${color}|${skin}|${dir}|${pose}`;
  const hit = cache.get(k); if (hit) return hit;
  const cv = makeCanvas(SPRITE_W, SPRITE_H);
  const c = cv.getContext('2d') as CanvasRenderingContext2D;
  const p = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  const body = color, dark = shade(color, 0.55), light = shade(color, 1.25);
  const sk = SKIN[skin % SKIN.length], hair = shade(color, 0.3);

  if (pose === POSE.FALL) {
    p(1, 11, 10, 4, dark); p(1, 11, 7, 3, body); p(8, 11, 3, 3, sk); p(0, 15, 12, 1, 'rgba(0,0,0,0.5)');
    cache.set(k, cv); return cv;
  }
  // shadow
  p(2, 15, 8, 1, 'rgba(0,0,0,0.55)');
  // legs
  const step = pose === POSE.WALK1 ? 1 : pose === POSE.WALK2 ? -1 : 0;
  p(3, 12, 2, 3 + (step > 0 ? 0 : 0), '#16161f'); p(7, 12, 2, 3, '#16161f');
  if (step === 1) { p(3, 12, 2, 2, '#16161f'); p(7, 13, 2, 2, '#16161f'); }
  if (step === -1) { p(3, 13, 2, 2, '#16161f'); p(7, 12, 2, 2, '#16161f'); }
  // torso
  p(2, 7, 8, 6, body); p(2, 7, 8, 1, light); p(2, 12, 8, 1, dark);
  // arms
  if (pose === POSE.CHEER) { p(0, 3, 2, 5, body); p(10, 3, 2, 5, body); p(0, 2, 2, 1, sk); p(10, 2, 2, 1, sk); }
  else if (pose === POSE.TALK) { p(1, 8, 1, 4, dark); p(10, 6, 2, 3, body); p(10, 5, 2, 1, sk); }
  else { const sw = step; p(1, 8 + (sw > 0 ? 1 : 0), 1, 4, dark); p(10, 8 + (sw < 0 ? 1 : 0), 1, 4, dark); }
  // head
  p(3, 1, 6, 6, sk);
  if (dir === 3) p(3, 1, 6, 5, hair);
  else {
    p(3, 1, 6, 2, hair);
    const ex = dir === 1 ? 3 : dir === 2 ? 6 : 4;
    if (dir === 0) { p(4, 4, 1, 1, '#0a0a0f'); p(7, 4, 1, 1, '#0a0a0f'); }
    else p(ex, 4, 1, 1, '#0a0a0f');
    if (pose === POSE.TALK) p(dir === 0 ? 5 : ex, 6, 2, 1, '#3a1a1a');
  }
  // role accessories
  switch (shape) {
    case 0: p(5, 7, 2, 4, '#e8e6f0'); p(5, 8, 2, 3, dark); break;                        // suit & tie
    case 1: p(2, 0, 8, 1, '#2a2a38'); p(1, 1, 10, 1, '#2a2a38'); p(8, 9, 3, 2, '#9ca3af'); break; // press hat + camera
    case 2: p(2, 7, 8, 8, body); p(1, 13, 10, 2, dark); p(3, 0, 6, 2, light); break;      // robe & hood
    case 3: p(2, 2, 1, 3, '#2a2a38'); p(9, 2, 1, 3, '#2a2a38'); p(2, 1, 8, 1, '#2a2a38'); break; // headset
    case 4: p(2, 0, 8, 3, '#1c1c26'); p(2, 3, 1, 4, '#1c1c26'); p(9, 3, 1, 4, '#1c1c26'); break; // dark hood
    case 5: for (let k = 0; k < 5; k++) p(2 + k, 7 + k, 2, 1, '#f5f3ff'); break;             // sash
    case 6: if (dir !== 3) p(3, 3, 6, 2, '#22d3ee'); break;                                // visor
    case 7: if (dir !== 3) { p(3, 4, 2, 1, '#e8e6f0'); p(7, 4, 2, 1, '#e8e6f0'); p(5, 4, 2, 1, '#9ca3af'); } break; // glasses
    case 8: p(2, 0, 8, 2, '#fde68a'); p(1, 1, 1, 3, '#fde68a'); p(10, 1, 1, 3, '#fde68a'); break; // bright hair
    case 9: p(5, -1 + 1, 2, 2, '#f87171'); p(5, 0, 2, 1, '#f87171'); p(4, 1, 4, 1, '#f87171'); break; // mohawk
  }
  cache.set(k, cv); return cv;
}

/** A tiny floating eye for observers. */
export function eyeSprite(): Canvas {
  const k = 'eye'; const hit = cache.get(k); if (hit) return hit;
  const cv = makeCanvas(9, 5); const c = cv.getContext('2d') as CanvasRenderingContext2D;
  const p = (x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(x, y, w, h); };
  p(2, 0, 5, 1, '#e8e6f0'); p(1, 1, 7, 3, '#e8e6f0'); p(2, 4, 5, 1, '#e8e6f0'); p(3, 1, 3, 3, '#c084fc'); p(4, 2, 1, 1, '#0a0a0f');
  cache.set(k, cv); return cv;
}
