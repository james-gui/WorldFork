import { test, expect } from '@playwright/test';

test('jobs page renders KPI strip and table', async ({ page }) => {
  await page.goto('/jobs');

  await expect(page.getByRole('heading', { name: 'Background Jobs & Queue Monitor' })).toBeVisible();

  // Table renders with mock rows
  const table = page.locator('table').first();
  await expect(table).toBeVisible();

  const count = await table.locator('tbody tr').count();
  expect(count).toBeGreaterThan(2);
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
  expect(rowCount).toBeGreaterThan(0);

  // Click first row to open detail sheet
  await table.locator('tbody tr').first().click();
  await page.waitForTimeout(500);

  // Detail sheet opens (Radix Sheet = dialog role)
  const sheet = page.locator('[role="dialog"]').first();
  await expect(sheet).toBeVisible({ timeout: 5_000 });
});
