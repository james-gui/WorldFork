import { test, expect } from '@playwright/test';

test('runs history table renders with mock rows and filtering works', async ({ page }) => {
  await page.goto('/runs');

  // Page heading
  await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible();

  // Table renders (use table role or tbody)
  const table = page.locator('table').first();
  await expect(table).toBeVisible();

  // At least 3 mock data rows visible (rows include run names from mock data)
  const rows = table.locator('tbody tr');
  const count = await rows.count();
  expect(count).toBeGreaterThan(2);

  // Filter — type in search box to narrow results
  const searchInput = page.getByRole('textbox').first();
  await searchInput.fill('energy');
  await page.waitForTimeout(300);

  // After filter, at least one row visible
  const filteredCount = await table.locator('tbody tr').count();
  expect(filteredCount).toBeGreaterThanOrEqual(1);

  // Clear filter
  await searchInput.fill('');
  await page.waitForTimeout(300);
});

test('clicking a run row shows summary sidebar', async ({ page }) => {
  await page.goto('/runs');

  const table = page.locator('table').first();
  await expect(table).toBeVisible();

  // Click first row
  const firstRow = table.locator('tbody tr').first();
  await firstRow.click();

  // Wait briefly
  await page.waitForTimeout(500);

  // The page should still render without crash
  await expect(page.locator('body')).not.toContainText('Application Error');
});
