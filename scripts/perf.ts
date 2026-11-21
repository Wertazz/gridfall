// Audit: time-to-world and FPS on desktop and on a throttled phone. npx tsx scripts/perf.ts [baseUrl]
import { chromium, devices } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3000';

(async () => {
  const b = await chromium.launch();
  for (const [name, ctxOpts, cpu] of [
    ['desktop 1440x900', { viewport: { width: 1440, height: 900 } }, 1],
    ['iPhone 14, CPU ×4 throttle', { ...devices['iPhone 14'] }, 4],
  ] as const) {
    const ctx = await b.newContext(ctxOpts);
    await ctx.addInitScript(() => { try { localStorage.setItem('gridfall.onboarded', '1'); } catch { /* noop */ } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const t0 = Date.now();
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
    await page.locator('header a[href="/proof"]').waitFor({ timeout: 30_000 });
    const ttw = Date.now() - t0;
    await page.waitForTimeout(1000);
    const fps = (await page.evaluate(`new Promise((res) => { let n = 0; const start = performance.now(); const f = () => { n++; if (performance.now() - start < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); })`)) as number;
    console.log(`${name}: world visible in ${ttw} ms, ${fps.toFixed(1)} fps`);
    await ctx.close();
  }
  await b.close();
})();
