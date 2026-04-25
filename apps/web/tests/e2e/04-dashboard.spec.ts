import { test, expect } from '@playwright/test';
import { firstRun } from './helpers';

test('dashboard page renders KPI strip, charts, feed, and scrubber', async ({ page, request }) => {
  const run = await firstRun(request);
  if (!run) {
    test.skip(true, 'requires at least one backend run');
    return;
  }

  await page.goto(`/runs/${run.run_id}/dashboard`);

  // Page heading
  await expect(page.getByRole('heading', { name: /Simulation Dashboard/i })).toBeVisible();

  await expect(page.getByText('Active Cohorts')).toBeVisible();
  await expect(page.getByText('Current Tick')).toBeVisible();
  await expect(page.getByText('Universes')).toBeVisible();
  await expect(page.getByText('Volatility')).toBeVisible();

  await expect(page.getByText('Live Social Feed')).toBeVisible();

  // Emotion Trends chart section
  await expect(page.getByText('Emotion Trends')).toBeVisible();

  await expect(page.getByRole('slider')).toBeVisible();
});
