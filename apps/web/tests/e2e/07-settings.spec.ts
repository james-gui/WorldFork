import { test, expect } from '@playwright/test';

test('settings main page renders 8 section cards', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByRole('heading', { name: 'Settings & Configuration' })).toBeVisible();

  // 8 section cards — use heading role to avoid strict mode violation (sidebar also has these as buttons)
  await expect(page.getByRole('heading', { name: 'Backend Provider' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Models' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Prompt Parameters' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sociology Presets' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Source-of-Truth Snapshots' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Memory' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OASIS Adapter' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Preferences' })).toBeVisible();
});

test('integrations page renders OpenRouter and local-memory state', async ({ page }) => {
  await page.goto('/settings/integrations');

  await expect(page.getByRole('heading', { name: 'Integrations & API Providers' })).toBeVisible();

  // This deployment is OpenRouter-only; Zep remains disabled in favor of local ledger memory.
  await expect(page.getByText('OpenRouter').first()).toBeVisible();
  await expect(page.getByText('Local Ledger Memory')).toBeVisible();
  await expect(page.getByText('Zep is disabled for this deployment.')).toBeVisible();
});

test('routing settings page renders policy table with rows', async ({ page }) => {
  await page.goto('/settings/routing');

  await expect(page.getByRole('heading', { name: 'Model Routing & Rate Limits' })).toBeVisible();

  // Table with routing policies (8 job types defined)
  const table = page.locator('table').first();
  await expect(table).toBeVisible();

  const rows = table.locator('tbody tr');
  const count = await rows.count();
  expect(count).toBeGreaterThan(2);
});
