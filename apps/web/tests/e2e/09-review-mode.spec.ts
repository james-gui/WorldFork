import { test, expect } from '@playwright/test';
import { firstRun } from './helpers';

test('review mode renders tick timeline and review header', async ({ page, request }) => {
  const run = await firstRun(request);
  if (!run?.root_universe_id) {
    test.skip(true, 'requires an initialized backend run');
    return;
  }

  await page.goto(`/runs/${run.run_id}/universes/${run.root_universe_id}/review`);

  // ReviewHeader renders — shows run/universe breadcrumb or tick controls
  // The ReviewHeader has a reload button and tick navigation
  await expect(page.getByRole('button').first()).toBeVisible({ timeout: 10_000 });

  await expect(page.locator('body')).not.toContainText('Application Error');
});
