// Phase screenshots: npx tsx scripts/capture.ts <label> [path] [actions]
// Desktop 1440×900 and iPhone 14. Output: test-results/shots/<label>-{desktop,iphone}.png
import { chromium, devices, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const label = process.argv[2] ?? 'shot';
const path = process.argv[3] ?? '/';
const action = process.argv[4] ?? '';
const base = process.env.BASE_URL ?? 'http://localhost:3000';
mkdirSync('test-results/shots', { recursive: true });

async function act(page: Page) {
  if (action.includes('wire')) await page.getByRole('button', { name: 'THE WIRE' }).click().catch(() => {});
  if (action.includes('zoom')) for (let k = 0; k < 2; k++) { await page.mouse.move(720, 450); await page.mouse.wheel(0, -100); await page.waitForTimeout(150); }
  if (action.includes('oracle')) await page.getByRole('button', { name: /LOOK AHEAD/ }).click().catch(() => {});
}

(async () => {
  const browser = await chromium.launch();
  for (const [name, ctx] of [
    ['desktop', { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
    ['iphone', { ...devices['iPhone 14'] }],
  ] as const) {
    const context = await browser.newContext({ ...ctx });
    await context.addInitScript(() => { try { localStorage.setItem('gridfall.onboarded', '1'); } catch { /* noop */ } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(base + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    await act(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `test-results/shots/${label}-${name}.png` });
    console.log(`${label}-${name}: ${errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'ok'}`);
    await context.close();
  }
  await browser.close();
})();
