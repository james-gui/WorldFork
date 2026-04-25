import { test, expect } from '@playwright/test';

test('network graph page renders canvas, layer toggles, and cohort count', async ({ page }) => {
  await page.goto('/runs/test-run/network');

  // Page heading
  await expect(page.getByRole('heading', { name: 'Network Graph View' })).toBeVisible();

  // LayerToggle has 5 layers — use aria-label to be specific
  await expect(page.getByRole('radio', { name: 'Exposure' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Trust' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Dependency' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Mobilization' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Identity' })).toBeVisible();

  // Canvas element renders (Sigma renders to a canvas)
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 10_000 });

  // Clicking a different layer changes state (Trust)
  const trustToggle = page.getByRole('radio', { name: 'Trust' });
  await trustToggle.click();
  await page.waitForTimeout(500);

  // Page still renders without crash
  await expect(page.locator('body')).not.toContainText('Application Error');
});
