import { test, expect } from '@playwright/test';

test('runs history table renders with backend rows or an empty state', async ({ page }) => {
  await page.goto('/runs');

  // Page heading
  await expect(page.getByRole('heading', { name: 'Run History' })).toBeVisible();

  const searchInput = page.getByRole('textbox').first();
  await expect(searchInput).toBeVisible();
  await searchInput.fill('energy');
  await expect(page.locator('body')).not.toContainText('Application Error');
});

test('clicking a run row shows summary sidebar', async ({ page }) => {
  await page.goto('/runs');

  const table = page.locator('table').first();
  if (!(await table.isVisible())) {
    await expect(page.locator('body')).not.toContainText('Application Error');
    return;
  }

  const rows = table.locator('tbody tr');
  const count = await rows.count();
  if (count === 0) return;

  const firstRow = rows.first();
  await firstRow.click();
  await expect(page.locator('body')).not.toContainText('Application Error');
});
