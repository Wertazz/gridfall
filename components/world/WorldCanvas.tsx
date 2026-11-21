'use client';

import { useEffect, useRef } from 'react';
import type { WorldEngine } from '@/lib/world/engine';

type Props = { engine: WorldEngine; onSelect: (uid: number, wx: number, wy: number) => void; onCamera?: (x: number, y: number) => void };

/** Full-screen canvas with pan (drag), zoom (wheel / pinch, integer steps) and tap-to-select. */
export default function WorldCanvas({ engine, onSelect, onCamera }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const css = getComputedStyle(document.body).getPropertyValue('--font-space-mono').trim();
    if (css) engine.font = `${css}, "Courier New", monospace`;
    void engine.start(canvas);
    const r = () => engine.renderer!;

    const ro = new ResizeObserver(() => {
      if (!engine.renderer) return;
      const rect = canvas.getBoundingClientRect();
      r().resize(rect.width, rect.height, Math.min(2, window.devicePixelRatio || 1));
    });
    ro.observe(canvas);
    const initSize = setInterval(() => {
      if (!engine.renderer) return;
      const rect = canvas.getBoundingClientRect();
      r().resize(rect.width, rect.height, Math.min(2, window.devicePixelRatio || 1));
      // Start zoomed on the heart of the city.
      const cam = r().cam; cam.z = cam.defaultZ;
      cam.x = 27 * 16; cam.y = 24 * 16; cam.clamp(r().w, r().h);
      clearInterval(initSize);
    }, 30);

    const pts = new Map<number, { x: number; y: number }>();
    let downAt = 0, downX = 0, downY = 0, moved = 0, pinchBase = 0;
    const report = () => onCamera?.(r().cam.x, r().cam.y);

    const zoomAt = (sx: number, sy: number, dz: number) => {
      const R = r(); const cam = R.cam;
      const nz = Math.max(cam.minZ, Math.min(cam.maxZ, cam.z + dz)); if (nz === cam.z) return;
      const before = cam.toWorld(sx, sy, R.w, R.h); cam.z = nz; const after = cam.toWorld(sx, sy, R.w, R.h);
      cam.x += before.x - after.x; cam.y += before.y - after.y; cam.clamp(R.w, R.h); report();
    };

    const onDown = (e: PointerEvent) => {
      engine.lastInteract = performance.now();
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { downAt = performance.now(); downX = e.clientX; downY = e.clientY; moved = 0; }
      if (pts.size === 2) { const [a, b] = Array.from(pts.values()); pinchBase = Math.hypot(a.x - b.x, a.y - b.y); }
    };
    const onMove = (e: PointerEvent) => {
      const p = pts.get(e.pointerId); if (!p || !engine.renderer) return;
      const R = r(); const dpr = R.dpr;
      if (pts.size === 1) {
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        if (Math.abs(dx) + Math.abs(dy) > 2) engine.follow = false;
        moved += Math.abs(dx) + Math.abs(dy);
        R.cam.x -= (dx * dpr) / R.cam.z; R.cam.y -= (dy * dpr) / R.cam.z; R.cam.clamp(R.w, R.h);
        report();
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        moved += 99;
        const [a, b] = Array.from(pts.values()); const d = Math.hypot(a.x - b.x, a.y - b.y);
        const rect = canvas.getBoundingClientRect();
        const mx = ((a.x + b.x) / 2 - rect.left) * dpr, my = ((a.y + b.y) / 2 - rect.top) * dpr;
        if (d > pinchBase * 1.22) { zoomAt(mx, my, 1); pinchBase = d; }
        else if (d < pinchBase / 1.22) { zoomAt(mx, my, -1); pinchBase = d; }
      }
    };
    const onUp = (e: PointerEvent) => {
      const wasSingle = pts.size === 1;
      pts.delete(e.pointerId);
      if (!wasSingle || moved > 8 || performance.now() - downAt > 500 || !engine.renderer) return;
      const R = r(); const rect = canvas.getBoundingClientRect();
      const w = R.cam.toWorld((downX - rect.left) * R.dpr, (downY - rect.top) * R.dpr, R.w, R.h);
      const v = engine.view(); if (!v) return;
      let best = -1, bd = 14 * 14;
      for (const p of v.poses) {
        const dx = p.x / 16 - w.x, dy = p.y / 16 - 6 - w.y; const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = p.uid; }
      }
      onSelect(best, w.x, w.y);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); if (!engine.renderer) return;
      engine.lastInteract = performance.now();
      const R = r(); const rect = canvas.getBoundingClientRect();
      zoomAt((e.clientX - rect.left) * R.dpr, (e.clientY - rect.top) * R.dpr, e.deltaY < 0 ? 1 : -1);
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      engine.stop(); ro.disconnect(); clearInterval(initSize);
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [engine, onSelect, onCamera]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full touch-none select-none" style={{ imageRendering: 'pixelated', cursor: 'grab' }} aria-label="THE GRID — live city map" role="img" />;
}
