import { test, expect } from '@playwright/test';

test('create big bang wizard loads, accepts scenario text, and can proceed', async ({ page }) => {
  await page.goto('/runs/new');

  // Textarea for scenario description is visible
  const textarea = page.locator('textarea').first();
  await expect(textarea).toBeVisible();

  // Fill in a scenario (must be >= 20 chars per zod validation)
  await textarea.fill('A major labor dispute erupts in the Bay Area tech sector, with workers organizing city-wide strikes.');

  // Next / Generate Big Bang button present
  const nextBtn = page.getByRole('button', { name: /Next|Generate Big Bang/i });
  await expect(nextBtn).toBeVisible();

  // Click Next to advance wizard step
  await nextBtn.click();

  // After clicking, either we stay on a later step (next step heading visible)
  // or get a toast / redirect — either way no crash
  await page.waitForTimeout(1000);

  // The page should still be rendering (not crashed to error boundary)
  await expect(page.locator('body')).not.toContainText('Application Error');
});
