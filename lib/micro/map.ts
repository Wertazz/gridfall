// THE GRID — 64 × 48 tiles, hand-laid in code. Static: never depends on time.
import { P, PLACE_COUNT, PLACE_NAMES } from '../sim/roster';

export const MAP_W = 64;
export const MAP_H = 48;
export const TILE = 16; // world pixels per tile

export const TL = {
  PAVE: 0, ROAD: 1, ROAD_LINE: 2, GRASS: 3, BUILDING: 4, WALL: 5, WATER: 6, PLAZA: 7,
  GRAVE: 8, RUBBLE: 9, DOOR: 10, MONUMENT: 11, TREE: 12, PATH: 13, CROSSWALK: 14, BRIDGE: 15,
} as const;
const BLOCKED = new Set<number>([TL.BUILDING, TL.WALL, TL.WATER, TL.GRAVE, TL.RUBBLE, TL.MONUMENT, TL.TREE]);

export type Rect = { x: number; y: number; w: number; h: number };
export type PlaceGeo = {
  id: number; name: string;
  building: Rect | null;      // blocked footprint, drawn as a building
  area: Rect;                 // where agents hang out
  door: { x: number; y: number } | null;
  anchor: { x: number; y: number };
  style: string;              // building renderer style
  color: string;              // neon accent
};

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

export const PLACES_GEO: PlaceGeo[] = [
  { id: P.STACKS,   name: '', building: r(22, 34, 10, 8), area: r(22, 44, 10, 3), door: { x: 26, y: 42 }, anchor: { x: 26, y: 45 }, style: 'stacks', color: '#60a5fa' },
  { id: P.NOVA,     name: '', building: r(48, 1, 11, 9),  area: r(46, 11, 15, 3), door: { x: 53, y: 10 }, anchor: { x: 53, y: 12 }, style: 'nova', color: '#c084fc' },
  { id: P.APEX,     name: '', building: r(4, 1, 9, 9),    area: r(3, 11, 12, 3),  door: { x: 8, y: 10 },  anchor: { x: 8, y: 12 },  style: 'apex', color: '#f43f5e' },
  { id: P.VAULT,    name: '', building: r(45, 18, 8, 8),  area: r(44, 27, 10, 3), door: { x: 48, y: 26 }, anchor: { x: 48, y: 28 }, style: 'vault', color: '#4ade80' },
  { id: P.WIRE,     name: '', building: r(55, 18, 8, 8),  area: r(55, 27, 9, 3),  door: { x: 58, y: 26 }, anchor: { x: 59, y: 28 }, style: 'wire', color: '#fb923c' },
  { id: P.UNION,    name: '', building: null,             area: r(23, 18, 10, 12), door: null,             anchor: { x: 27, y: 21 }, style: 'square', color: '#86efac' },
  { id: P.EDEN,     name: '', building: r(32, 2, 9, 7),   area: r(32, 10, 9, 4),  door: { x: 36, y: 9 },  anchor: { x: 36, y: 11 }, style: 'eden', color: '#34d399' },
  { id: P.EXCHANGE, name: '', building: r(34, 18, 7, 8),  area: r(34, 27, 8, 3),  door: { x: 37, y: 26 }, anchor: { x: 37, y: 28 }, style: 'exchange', color: '#fbbf24' },
  { id: P.NYX,      name: '', building: r(10, 18, 9, 7),  area: r(10, 26, 9, 4),  door: { x: 14, y: 25 }, anchor: { x: 14, y: 27 }, style: 'nyx', color: '#f472b6' },
  { id: P.ALLEY,    name: '', building: null,             area: r(1, 18, 6, 12),  door: null,             anchor: { x: 4, y: 23 },  style: 'alley', color: '#6ee7b7' },
  { id: P.ORACLE,   name: '', building: r(24, 1, 5, 8),   area: r(23, 10, 8, 4),  door: { x: 26, y: 9 },  anchor: { x: 26, y: 11 }, style: 'oracle', color: '#60a5fa' },
  { id: P.CEMETERY, name: '', building: null,             area: r(45, 35, 18, 12), door: null,            anchor: { x: 53, y: 36 }, style: 'cemetery', color: '#a5b4fc' },
  { id: P.RUINS,    name: '', building: null,             area: r(1, 34, 18, 13), door: null,             anchor: { x: 9, y: 36 },  style: 'ruins', color: '#9ca3af' },
  { id: P.NOODLE,   name: '', building: r(34, 34, 7, 7),  area: r(33, 42, 9, 4),  door: { x: 37, y: 41 }, anchor: { x: 37, y: 43 }, style: 'noodle', color: '#f472b6' },
];
PLACES_GEO.forEach((p) => (p.name = PLACE_NAMES[p.id]));
PLACES_GEO.sort((a, b) => a.id - b.id);
if (PLACES_GEO.length !== PLACE_COUNT) throw new Error('place geometry mismatch');

/** Ruins of Season 1: one ruin per V1 day + the terminal monument. */
export const RUIN_SPOTS: Array<{ x: number; y: number; day: number }> = [
  { x: 3, y: 38, day: 1 }, { x: 7, y: 41, day: 2 }, { x: 12, y: 38, day: 3 }, { x: 16, y: 41, day: 4 },
  { x: 3, y: 44, day: 5 }, { x: 9, y: 45, day: 6 }, { x: 15, y: 44, day: 7 }, { x: 9, y: 39, day: 0 },
];

/** Cemetery plots (tile of each headstone, filled in order of death). */
export const GRAVE_SPOTS: Array<{ x: number; y: number }> = [];
for (let y = 38; y <= 45; y += 2) for (let x = 46; x <= 61; x += 2) GRAVE_SPOTS.push({ x, y });

export const LAMPS: Array<{ x: number; y: number }> = [];
export const TREES: Array<{ x: number; y: number }> = [];

function buildGrid(): Uint8Array {
  const g = new Uint8Array(MAP_W * MAP_H).fill(TL.PAVE);
  const set = (x: number, y: number, v: number) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) g[y * MAP_W + x] = v; };
  const fill = (rc: Rect, v: number) => { for (let y = rc.y; y < rc.y + rc.h; y++) for (let x = rc.x; x < rc.x + rc.w; x++) set(x, y, v); };

  // Roads: two avenues, two cross streets.
  fill(r(0, 15, MAP_W, 2), TL.ROAD); fill(r(0, 31, MAP_W, 2), TL.ROAD);
  fill(r(20, 0, 2, MAP_H), TL.ROAD); fill(r(42, 0, 2, MAP_H), TL.ROAD);
  for (let x = 0; x < MAP_W; x += 2) { set(x, 15, TL.ROAD_LINE); set(x, 31, TL.ROAD_LINE); }
  for (let y = 0; y < MAP_H; y += 2) { set(20, y, TL.ROAD_LINE); set(42, y, TL.ROAD_LINE); }
  for (const [cx, cy] of [[20, 15], [42, 15], [20, 31], [42, 31]]) fill(r(cx, cy, 2, 2), TL.CROSSWALK);

  // Plazas under each hangout area.
  for (const p of PLACES_GEO) fill(p.area, p.style === 'cemetery' || p.style === 'ruins' ? TL.GRASS : TL.PLAZA);

  // Union Square: lawn border, central monument.
  fill(r(23, 18, 10, 12), TL.PLAZA);
  fill(r(27, 23, 2, 2), TL.MONUMENT);
  for (const [x, y] of [[23, 18], [32, 18], [23, 29], [32, 29]]) { set(x, y, TL.TREE); TREES.push({ x, y }); }

  // Ghost Alley: walled, narrow, dirty.
  fill(r(0, 17, 1, 14), TL.WALL); fill(r(7, 17, 1, 14), TL.WALL);
  fill(r(1, 18, 6, 12), TL.PATH);
  for (const [x, y] of [[2, 20], [5, 24], [2, 28]]) set(x, y, TL.RUBBLE);

  // Buildings.
  for (const p of PLACES_GEO) if (p.building) fill(p.building, TL.BUILDING);
  for (const p of PLACES_GEO) if (p.door) set(p.door.x, p.door.y, TL.DOOR);

  // Cemetery: fence, path, headstones.
  fill(r(44, 34, 1, 14), TL.WALL); fill(r(44, 34, 20, 1), TL.WALL); set(53, 34, TL.PATH); set(54, 34, TL.PATH);
  for (let y = 35; y < MAP_H; y++) for (let x = 45; x < MAP_W; x++) if (y % 2 === 1) set(x, y, TL.PATH);
  for (const gs of GRAVE_SPOTS) set(gs.x, gs.y, TL.GRAVE);

  // Ruins: rubble around each ruin, grass between.
  for (const rs of RUIN_SPOTS) { set(rs.x, rs.y, TL.RUBBLE); set(rs.x + 1, rs.y, TL.RUBBLE); }
  for (const [x, y] of [[5, 35], [14, 35], [18, 46], [1, 46], [11, 43]]) set(x, y, TL.RUBBLE);

  // Neon canal along the far east edge of the north blocks, with a bridge.
  fill(r(62, 0, 2, 15), TL.WATER); set(62, 12, TL.BRIDGE); set(63, 12, TL.BRIDGE);
  fill(r(0, 0, 2, 9), TL.WATER);

  // Trees and lamps along avenues.
  for (let x = 2; x < MAP_W - 2; x += 6) {
    for (const y of [14, 17, 30, 33]) {
      const k = y * MAP_W + x;
      if (g[k] === TL.PAVE) { g[k] = TL.TREE; TREES.push({ x, y }); }
      else if (g[k] === TL.PLAZA || g[k] === TL.PATH || g[k] === TL.GRASS) LAMPS.push({ x, y });
    }
  }
  for (let y = 3; y < MAP_H - 2; y += 5) for (const x of [19, 22, 41, 44]) if (g[y * MAP_W + x] === TL.PAVE) LAMPS.push({ x, y });
  return g;
}

export const GRID = buildGrid();

export function walkable(x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  return !BLOCKED.has(GRID[y * MAP_W + x]);
}

/** Walkable tiles of a place's hangout area (sorted, stable). */
export const AREA_TILES: Array<Array<{ x: number; y: number }>> = PLACES_GEO.map((p) => {
  const out: Array<{ x: number; y: number }> = [];
  for (let y = p.area.y; y < p.area.y + p.area.h; y++) for (let x = p.area.x; x < p.area.x + p.area.w; x++) if (walkable(x, y)) out.push({ x, y });
  return out;
});
