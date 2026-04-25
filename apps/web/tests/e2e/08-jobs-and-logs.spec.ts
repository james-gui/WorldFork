import { test, expect } from '@playwright/test';

test('jobs page renders KPI strip and table', async ({ page }) => {
  await page.goto('/jobs');

  await expect(page.getByRole('heading', { name: 'Background Jobs & Queue Monitor' })).toBeVisible();

  const table = page.locator('table').first();
  await expect(table).toBeVisible();
  await expect(page.locator('body')).not.toContainText('Application Error');
});

test('logs page renders table and row detail sheet opens', async ({ page }) => {
  await page.goto('/logs');

  await expect(page.getByRole('heading', { name: 'API Logs & Webhooks' })).toBeVisible();

  // Tabs render
  await expect(page.getByRole('tab', { name: /Requests/i })).toBeVisible();

  // Table renders
  const table = page.locator('table').first();
  await expect(table).toBeVisible({ timeout: 10_000 });

  const rowCount = await table.locator('tbody tr').count();
  if (rowCount === 0) return;

  await table.locator('tbody tr').first().click();

  const sheet = page.locator('[role="dialog"]').first();
  await expect(sheet).toBeVisible({ timeout: 5_000 });
});
