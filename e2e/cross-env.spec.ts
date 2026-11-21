import { test, expect } from '@playwright/test';
import { genesisState, replay } from '../lib/sim/step';
import { stateHash } from '../lib/sim/state';
import { GENESIS_MS, HOUR_MS, MINUTE_MS } from '../lib/sim/config';

// The same instant must hash identically in Node and in Chromium.
const hoursAgo = [2, 30, 150];

for (const h of hoursAgo) {
  test(`Node and Chromium agree ${h} world hours ago`, async ({ page }) => {
    const nowHour = Math.floor((Date.now() - GENESIS_MS) / HOUR_MS);
    const H = Math.max(0, nowHour - h);
    const t = GENESIS_MS + H * HOUR_MS + MINUTE_MS; // one world minute into the hour: seconds of playback won't cross it
    const expected = stateHash(replay(genesisState(), H + 1));
    await page.addInitScript(() => { try { localStorage.setItem('gridfall.onboarded', '1'); } catch { /* noop */ } });
    await page.goto(`/t/${new Date(t).toISOString().replace('.000Z', 'Z')}`);
    const link = page.locator('header a[href="/proof"]');
    await expect(link).toContainText('#', { timeout: 20_000 });
    const shown = (await link.innerText()).replace(/[^0-9a-f]/g, '').slice(-8);
    expect(expected.startsWith(shown)).toBe(true);
  });
}

test('the /proof page shows the same hash as Node for now', async ({ page }) => {
  await page.goto('/proof');
  const el = page.getByTestId('proof-hash');
  await expect(el).not.toContainText('·', { timeout: 20_000 });
  const shown = (await el.innerText()).replace('#', '').trim();
  const hour = Math.floor((Date.now() - GENESIS_MS) / MINUTE_MS / 60) + 1;
  const candidates = [hour, hour - 1, hour + 1].map((x) => stateHash(replay(genesisState(), x)));
  expect(candidates).toContain(shown);
});
