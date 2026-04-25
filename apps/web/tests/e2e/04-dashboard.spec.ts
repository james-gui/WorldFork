import { test, expect } from '@playwright/test';

test('dashboard page renders KPI strip, charts, feed, and scrubber', async ({ page }) => {
  await page.goto('/runs/test-run/dashboard');

  // Page heading
  await expect(page.getByRole('heading', { name: /Simulation Dashboard/i })).toBeVisible();

  // KPI strip — 4 cards: Active Cohorts, Pending Events, Branch Count, Dominant Emotion
  await expect(page.getByText('Active Cohorts')).toBeVisible();
  await expect(page.getByText('Pending Events')).toBeVisible();
  await expect(page.getByText('Branch Count')).toBeVisible();
  await expect(page.getByText('Dominant Emotion')).toBeVisible();

  // LiveSocialFeed renders (has posts container)
  await expect(page.getByText('Live Social Feed').or(page.locator('[class*="feed"]')).first()).toBeVisible();

  // Emotion Trends chart section
  await expect(page.getByText('Emotion Trends')).toBeVisible();

  // Tick scrubber visible (shows "Tick" label)
  await expect(page.getByText(/^Tick$/i)).toBeVisible();
});
