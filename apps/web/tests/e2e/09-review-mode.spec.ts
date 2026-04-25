import { test, expect } from '@playwright/test';

test('review mode renders tick timeline and review header', async ({ page }) => {
  await page.goto('/runs/r/universes/u/review');

  // ReviewHeader renders — shows run/universe breadcrumb or tick controls
  // The ReviewHeader has a reload button and tick navigation
  await expect(page.getByRole('button').first()).toBeVisible({ timeout: 10_000 });

  // TickTimelineRail renders — shows numbered ticks (1-10)
  await expect(page.getByText('1').first()).toBeVisible();

  // Should show tick summaries from TIMELINE_SUMMARIES
  await expect(page.getByText(/Initialization|Policy|Cohort|Strike/i).first()).toBeVisible();

  // ReviewPlaybackControls render at bottom
  // Controls have play/pause type buttons
  await expect(page.getByRole('button').last()).toBeVisible();

  // Page renders without crash
  await expect(page.locator('body')).not.toContainText('Application Error');
});
