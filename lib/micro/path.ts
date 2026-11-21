// Deterministic A* (4-neighbour, integer costs, total-order tie-breaking).
import { MAP_W, MAP_H, walkable, PLACES_GEO } from './map';

/** Binary min-heap of integer keys. */
class Heap {
  a: number[] = [];
  push(v: number) {
    const a = this.a; a.push(v); let i = a.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (a[p] <= v) break; a[i] = a[p]; i = p; }
    a[i] = v;
  }
  pop(): number {
    const a = this.a; const top = a[0]; const last = a.pop()!;
    if (a.length) {
      let i = 0; const n = a.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        let mv = last;
        if (l < n && a[l] < mv) { m = l; mv = a[l]; }
        if (r < n && a[r] < mv) { m = r; }
        if (m === i) break;
        a[i] = a[m]; i = m;
      }
      a[i] = last;
    }
    return top;
  }
  get size() { return this.a.length; }
}

const N = MAP_W * MAP_H;

/** Returns tile indices from start to goal inclusive ([] if unreachable). */
export function astar(sx: number, sy: number, gx: number, gy: number): number[] {
  const start = sy * MAP_W + sx, goal = gy * MAP_W + gx;
  if (start === goal) return [start];
  const g = new Int32Array(N).fill(0x3fffffff);
  const came = new Int32Array(N).fill(-1);
  const closed = new Uint8Array(N);
  const heap = new Heap();
  const hfn = (i: number) => Math.abs((i % MAP_W) - gx) + Math.abs(((i / MAP_W) | 0) - gy);
  // key = ((f * 1024) + h) * 4096 + index  → unique & totally ordered
  const push = (i: number) => heap.push(((g[i] + hfn(i)) * 1024 + hfn(i)) * 4096 + i);
  g[start] = 0; push(start);
  while (heap.size) {
    const k = heap.pop(); const i = k % 4096;
    if (closed[i]) continue;
    if (i === goal) break;
    closed[i] = 1;
    const x = i % MAP_W, y = (i / MAP_W) | 0;
    const nb = [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]];
    for (const [nx, ny] of nb) {
      if (!walkable(nx, ny) && !(nx === gx && ny === gy)) continue;
      const j = ny * MAP_W + nx;
      const ng = g[i] + 1;
      if (ng < g[j]) { g[j] = ng; came[j] = i; push(j); }
    }
  }
  if (came[goal] < 0) return [];
  const out: number[] = [goal];
  let c = goal;
  while (c !== start) { c = came[c]; out.push(c); }
  return out.reverse();
}

/** All place-to-place paths, computed once. PATHS[a][b] = tile indices. */
let PATHS: number[][][] | null = null;
export function paths(): number[][][] {
  if (PATHS) return PATHS;
  PATHS = PLACES_GEO.map((a) => PLACES_GEO.map((b) => astar(a.anchor.x, a.anchor.y, b.anchor.x, b.anchor.y)));
  return PATHS;
}
