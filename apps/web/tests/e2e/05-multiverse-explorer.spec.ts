import { test, expect } from '@playwright/test';
import { firstRun } from './helpers';

test('multiverse explorer renders canvas with nodes and KPI strip', async ({ page, request }) => {
  const run = await firstRun(request);
  if (!run) {
    test.skip(true, 'requires at least one backend run');
    return;
  }

  await page.goto(`/runs/${run.run_id}/multiverse`);

  // Page heading
  await expect(page.getByRole('heading', { name: /Recursive Multiverse Explorer/i })).toBeVisible();

  await expect(page.getByText(/Total Universes|Active|Max Depth|Avg Depth/i).first()).toBeVisible();

  // React Flow canvas container renders
  // React Flow renders a div with class "react-flow" or role="application"
  const canvas = page.locator('.react-flow, [class*="react-flow"]').first();
  await expect(canvas).toBeVisible({ timeout: 10_000 });

  await expect(page.getByText(/\d+\/\d+ visible/)).toBeVisible({ timeout: 10_000 });
});
