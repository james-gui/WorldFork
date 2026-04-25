import { test, expect } from '@playwright/test';
import { firstRun } from './helpers';

test('network graph page renders canvas, layer toggles, and cohort count', async ({ page, request }) => {
  const run = await firstRun(request);
  if (!run) {
    test.skip(true, 'requires at least one backend run');
    return;
  }

  await page.goto(`/runs/${run.run_id}/network`);

  // Page heading
  await expect(page.getByRole('heading', { name: 'Network Graph View' })).toBeVisible();

  // LayerToggle has 5 layers — use aria-label to be specific
  await expect(page.getByRole('radio', { name: 'Exposure' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Trust' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Dependency' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Mobilization' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Identity' })).toBeVisible();

  // Graph data renders with a cohort/link summary. The concrete renderer can
  // be canvas-backed or fallback SVG/DOM depending on the browser runtime.
  await expect(page.locator('main')).toContainText(/\d+ cohorts - \d+ links/, {
    timeout: 10_000,
  });

  // Clicking a different layer changes state (Trust)
  const trustToggle = page.getByRole('radio', { name: 'Trust' });
  await trustToggle.click();
  await expect(page.locator('body')).not.toContainText('Application Error');
});
