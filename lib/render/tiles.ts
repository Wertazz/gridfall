// Procedural pixel art for the static city layer (drawn once into an offscreen canvas).
import { GRID, MAP_W, MAP_H, TILE, TL, PLACES_GEO, RUIN_SPOTS, TREES, type Rect } from '../micro/map';
import { mix } from '../sim/prng';

export type Window = { x: number; y: number; w: number; h: number; seed: number; place: number };
export const WINDOWS: Window[] = [];
export const NEON_SPOTS: Array<{ x: number; y: number; color: string; r: number }> = [];

type C2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const px = (c: C2D, x: number, y: number, w: number, h: number, col: string) => { c.fillStyle = col; c.fillRect(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h)); };
const noise = (x: number, y: number, s = 0) => mix((x * 73856093) ^ (y * 19349663) ^ s);

function tileAt(x: number, y: number) { return x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? -1 : GRID[y * MAP_W + x]; }
const isRoad = (t: number) => t === TL.ROAD || t === TL.ROAD_LINE || t === TL.CROSSWALK;

function drawTile(c: C2D, tx: number, ty: number) {
  const t = GRID[ty * MAP_W + tx];
  const x = tx * TILE, y = ty * TILE;
  const n = noise(tx, ty);
  const speck = (base: string, dot: string, count: number) => {
    px(c, x, y, TILE, TILE, base);
    for (let k = 0; k < count; k++) { const h = mix(n + k); px(c, x + (h % 16), y + ((h >>> 4) % 16), 1, 1, dot); }
  };
  switch (t) {
    case TL.PAVE: speck('#14141d', '#1a1a26', 3); px(c, x, y, TILE, 1, '#181824'); px(c, x, y, 1, TILE, '#181824'); break;
    case TL.ROAD: speck('#0d0d13', '#121219', 4); break;
    case TL.ROAD_LINE: {
      speck('#0d0d13', '#121219', 4);
      const horiz = isRoad(tileAt(tx - 1, ty)) && isRoad(tileAt(tx + 1, ty)) && !(isRoad(tileAt(tx, ty - 1)) && isRoad(tileAt(tx, ty + 1)) && tx % 2 === 0 && (tx === 20 || tx === 42));
      if (tx === 20 || tx === 42) px(c, x + 15, y + 3, 2, 10, '#3d361c');
      else if (horiz) px(c, x + 3, y + 15, 10, 2, '#3d361c');
      break;
    }
    case TL.CROSSWALK: px(c, x, y, TILE, TILE, '#0d0d13'); for (let k = 1; k < 16; k += 4) px(c, x + k, y + 1, 2, 14, '#24242f'); break;
    case TL.GRASS: speck('#0c1a13', '#11261a', 6); break;
    case TL.PLAZA: px(c, x, y, TILE, TILE, (tx + ty) % 2 ? '#191725' : '#1b1928'); px(c, x, y, TILE, 1, '#211f30'); break;
    case TL.PATH: speck('#191712', '#211e17', 5); break;
    case TL.WALL: px(c, x, y, TILE, TILE, '#1f1f2b'); for (let r = 0; r < 4; r++) { px(c, x, y + r * 4, TILE, 1, '#16161f'); px(c, x + ((r % 2) * 8), y + r * 4, 1, 4, '#16161f'); } break;
    case TL.WATER: px(c, x, y, TILE, TILE, '#07112a'); px(c, x + (n % 8), y + 4, 6, 1, '#163a7a'); px(c, x + ((n >>> 3) % 8) + 4, y + 11, 5, 1, '#0f2a5c'); break;
    case TL.BRIDGE: px(c, x, y, TILE, TILE, '#2a2016'); for (let k = 0; k < 16; k += 3) px(c, x, y + k, TILE, 1, '#1d160f'); break;
    case TL.GRAVE: speck('#0c1a13', '#11261a', 4); break;
    case TL.RUBBLE: speck('#0c1a13', '#11261a', 3); for (let k = 0; k < 5; k++) { const h = mix(n ^ (k * 977)); px(c, x + 2 + (h % 11), y + 3 + ((h >>> 5) % 10), 3, 2, k % 2 ? '#2e2e38' : '#3a3a46'); } break;
    case TL.DOOR: px(c, x, y, TILE, TILE, '#1b1928'); break;
    case TL.MONUMENT: px(c, x, y, TILE, TILE, '#1b1928'); break;
    case TL.TREE: px(c, x, y, TILE, TILE, '#14141d'); break;
    case TL.BUILDING: px(c, x, y, TILE, TILE, '#0a0a0f'); break;
    default: px(c, x, y, TILE, TILE, '#14141d');
  }
}

function windowsGrid(c: C2D, rc: Rect, place: number, opts: { cols: number; rows: number; w: number; h: number; top: number; frame: string }) {
  const X = rc.x * TILE, Y = rc.y * TILE, W = rc.w * TILE;
  const gapX = Math.floor((W - 8) / opts.cols);
  for (let r = 0; r < opts.rows; r++) {
    for (let k = 0; k < opts.cols; k++) {
      const wx = X + 4 + k * gapX + Math.floor((gapX - opts.w) / 2), wy = Y + opts.top + r * (opts.h + 4);
      px(c, wx, wy, opts.w, opts.h, opts.frame);
      WINDOWS.push({ x: wx, y: wy, w: opts.w, h: opts.h, seed: mix(wx * 31 + wy * 17 + place), place });
    }
  }
}

function building(c: C2D, rc: Rect, style: string, place: number, accent: string, door: { x: number; y: number } | null) {
  const X = rc.x * TILE, Y = rc.y * TILE, W = rc.w * TILE, H = rc.h * TILE;
  const body = (col: string, roof: string) => { px(c, X, Y, W, H, col); px(c, X, Y, W, 3, roof); px(c, X, Y + H - 2, W, 2, '#050508'); px(c, X, Y, 2, H, roof); };
  switch (style) {
    case 'nova':
      body('#17112a', '#2b1f4a');
      for (let k = 0; k < 3; k++) px(c, X + 10 + k * ((W - 20) / 2), Y + 3, 2, H - 6, '#3b2766');
      windowsGrid(c, rc, place, { cols: 7, rows: 9, w: 6, h: 6, top: 10, frame: '#0d0a18' });
      px(c, X + W / 2 - 10, Y + 4, 20, 4, accent); NEON_SPOTS.push({ x: X + W / 2, y: Y + 6, color: accent, r: 40 });
      break;
    case 'apex':
      body('#1d0f14', '#3a1620');
      for (let k = 0; k < 4; k++) px(c, X + W / 2 - 4 - k * 6, Y + 2 + k * 3, 8 + k * 12, 3, '#4a1a28');
      windowsGrid(c, rc, place, { cols: 6, rows: 8, w: 5, h: 7, top: 18, frame: '#100709' });
      px(c, X + W / 2 - 1, Y - 6, 2, 8, accent); NEON_SPOTS.push({ x: X + W / 2, y: Y - 4, color: accent, r: 30 });
      break;
    case 'vault':
      body('#0e1a13', '#1d3326');
      for (let k = 0; k < W; k += 12) px(c, X + k, Y + 6, 4, H - 12, '#14261c');
      windowsGrid(c, rc, place, { cols: 5, rows: 3, w: 5, h: 4, top: 10, frame: '#08100b' });
      { // the vault door, visible from the street
        const cx = X + W / 2, cy = Y + H - 26;
        for (let dy = -14; dy <= 14; dy++) for (let dx = -14; dx <= 14; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 <= 196) px(c, cx + dx, cy + dy, 1, 1, d2 > 150 ? '#5b6b62' : d2 > 100 ? '#3d4a43' : '#2b3530');
        }
        px(c, cx - 1, cy - 10, 2, 20, '#7d8f85'); px(c, cx - 10, cy - 1, 20, 2, '#7d8f85');
      }
      NEON_SPOTS.push({ x: X + W / 2, y: Y + 4, color: accent, r: 28 });
      break;
    case 'wire':
      body('#1f140b', '#3b2512');
      windowsGrid(c, rc, place, { cols: 5, rows: 6, w: 6, h: 5, top: 12, frame: '#120b06' });
      px(c, X + W - 18, Y - 10, 2, 12, '#6b4a2a'); px(c, X + W - 22, Y - 10, 10, 2, '#6b4a2a');
      NEON_SPOTS.push({ x: X + W - 17, y: Y - 10, color: accent, r: 22 });
      px(c, X + 8, Y + H - 22, W - 16, 10, '#2a1a0c');
      break;
    case 'eden':
      body('#0e1914', '#24402f');
      for (let k = 0; k < 7; k++) px(c, X + 8 + k * ((W - 20) / 6), Y + 22, 4, H - 26, '#2f4a3a');
      px(c, X + 6, Y + 16, W - 12, 4, '#35553f');
      for (let k = 0; k < 10; k++) px(c, X + W / 2 - 20 + k * 2, Y + 4 + Math.abs(5 - k), 40 - k * 4, 2, '#2a4a36');
      NEON_SPOTS.push({ x: X + W / 2, y: Y + 10, color: accent, r: 34 });
      break;
    case 'exchange':
      body('#1a1608', '#3a3112');
      windowsGrid(c, rc, place, { cols: 5, rows: 2, w: 6, h: 5, top: 70, frame: '#100d05' });
      px(c, X + 6, Y + 8, W - 12, 52, '#050505'); // ticker screen (drawn live)
      NEON_SPOTS.push({ x: X + W / 2, y: Y + 34, color: accent, r: 46 });
      break;
    case 'nyx':
      body('#1a0c16', '#331528');
      windowsGrid(c, rc, place, { cols: 6, rows: 3, w: 4, h: 4, top: 14, frame: '#0e060b' });
      for (let k = 0; k < 5; k++) px(c, X + W / 2 - 12 + k * 2, Y + H - 14 + k * 2, 24 - k * 4, 2, '#3d1832');
      px(c, X + W / 2 - 3, Y + 6, 6, 6, accent); NEON_SPOTS.push({ x: X + W / 2, y: Y + 9, color: accent, r: 30 });
      break;
    case 'oracle':
      body('#0b1322', '#1b2a48');
      windowsGrid(c, rc, place, { cols: 2, rows: 10, w: 4, h: 6, top: 18, frame: '#060b14' });
      { const cx = X + W / 2, cy = Y + 9; px(c, cx - 7, cy - 2, 14, 4, '#bfdbfe'); px(c, cx - 2, cy - 2, 4, 4, '#1e3a8a'); }
      NEON_SPOTS.push({ x: X + W / 2, y: Y + 9, color: accent, r: 44 });
      break;
    case 'stacks':
      body('#11141f', '#1f2438');
      for (let k = 1; k < 3; k++) px(c, X + (W * k) / 3, Y, 2, H, '#0a0c14');
      windowsGrid(c, rc, place, { cols: 9, rows: 9, w: 4, h: 4, top: 8, frame: '#080a10' });
      break;
    case 'noodle':
      body('#1c0d18', '#3a1530');
      windowsGrid(c, rc, place, { cols: 4, rows: 2, w: 7, h: 6, top: 40, frame: '#0e060c' });
      for (let dx = -10; dx <= 10; dx++) { const dy = (dx * dx) >> 3; px(c, X + W / 2 + dx, Y + 24 + dy - 12, 1, 2, accent); }
      px(c, X + W / 2 - 10, Y + 10, 20, 2, accent);
      NEON_SPOTS.push({ x: X + W / 2, y: Y + 18, color: accent, r: 36 });
      break;
  }
  if (door) {
    const dx = door.x * TILE, dy = door.y * TILE;
    px(c, dx + 3, dy, 10, 12, '#050508'); px(c, dx + 2, dy, 12, 1, accent); px(c, dx + 2, dy, 1, 12, accent); px(c, dx + 13, dy, 1, 12, accent);
    NEON_SPOTS.push({ x: dx + 8, y: dy + 2, color: accent, r: 14 });
  }
}

function tree(c: C2D, tx: number, ty: number) {
  const x = tx * TILE, y = ty * TILE;
  px(c, x + 7, y + 10, 2, 5, '#2a1d12');
  const blob: Array<[number, number, number, number, string]> = [
    [3, 3, 10, 7, '#0f2a1b'], [2, 5, 12, 4, '#0f2a1b'], [4, 2, 8, 2, '#123320'], [5, 4, 4, 2, '#1a4a2c'],
  ];
  for (const [bx, by, bw, bh, col] of blob) px(c, x + bx, y + by, bw, bh, col);
}

function monument(c: C2D) {
  const x = 27 * TILE, y = 23 * TILE;
  px(c, x + 4, y + 22, 24, 8, '#2a2840'); px(c, x + 8, y + 16, 16, 6, '#34324e');
  px(c, x + 13, y + 2, 6, 14, '#454264'); px(c, x + 11, y + 6, 10, 3, '#454264'); px(c, x + 14, y, 4, 3, '#5b5885');
  NEON_SPOTS.push({ x: x + 16, y: y + 12, color: '#86efac', r: 30 });
}

function ruin(c: C2D, tx: number, ty: number, day: number) {
  const x = tx * TILE, y = ty * TILE; const n = mix(day * 991 + 7);
  if (day === 0) { // the terminal monolith of Season 1
    px(c, x + 6, y - 14, 18, 28, '#111118'); px(c, x + 8, y - 12, 14, 24, '#1a1a24');
    px(c, x + 10, y - 8, 10, 1, '#c084fc'); px(c, x + 10, y - 4, 7, 1, '#c084fc');
    NEON_SPOTS.push({ x: x + 15, y: y - 6, color: '#c084fc', r: 26 });
    return;
  }
  const h = 10 + (n % 14);
  px(c, x + 2, y + 16 - h, 12, h, '#22222c'); px(c, x + 2, y + 16 - h, 12, 2, '#2e2e3a');
  for (let k = 0; k < 4; k++) { const m = mix(n + k); px(c, x + 2 + (m % 10), y + 16 - h + ((m >>> 4) % 2), 2 + (m % 3), 2 + ((m >>> 8) % 3), '#0a0a0f'); }
  px(c, x + 14, y + 10, 10, 6, '#1c1c25');
  NEON_SPOTS.push({ x: x + 8, y: y + 16 - h, color: '#9ca3af', r: 10 });
}

export function drawStatic(c: C2D) {
  WINDOWS.length = 0; NEON_SPOTS.length = 0;
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) drawTile(c, tx, ty);
  for (const p of PLACES_GEO) if (p.building) building(c, p.building, p.style, p.id, p.color, p.door);
  for (const t of TREES) tree(c, t.x, t.y);
  monument(c);
  for (const r of RUIN_SPOTS) ruin(c, r.x, r.y, r.day);
}
