import { test, expect } from '@playwright/test';

test('landing page renders hero CTA, 6 feature cards, and footer', async ({ page }) => {
  await page.goto('/');

  // Hero CTA link text
  await expect(page.getByRole('link', { name: /Start a New Simulation/i })).toBeVisible();

  // Feature grid — 6 feature cards
  const featureCards = page.locator('section').filter({ hasText: 'Multiverse Simulation' }).locator('a');
  // Count cards by their link labels (6 features)
  const allLinks = page.getByRole('link', { name: /Explore simulations|Open graph view|Open graph goal|View run history|Open settings|View logs/i });
  await expect(allLinks).toHaveCount(6);

  // Footer renders (check for footer element or known footer text)
  await expect(page.locator('footer')).toBeVisible();
});
