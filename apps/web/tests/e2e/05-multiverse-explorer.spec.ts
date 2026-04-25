import { test, expect } from '@playwright/test';

test('multiverse explorer renders canvas with nodes and KPI strip', async ({ page }) => {
  await page.goto('/runs/test-run/multiverse');

  // Page heading
  await expect(page.getByRole('heading', { name: /Recursive Multiverse Explorer/i })).toBeVisible();

  // KPI strip renders (shows kpi labels from KpiStrip component)
  // The KpiStrip on multiverse shows things like "Total Universes", "Active", etc.
  await expect(page.getByText(/Total Universes|Active|Max Depth|Avg Depth/i).first()).toBeVisible();

  // React Flow canvas container renders
  // React Flow renders a div with class "react-flow" or role="application"
  const canvas = page.locator('.react-flow, [class*="react-flow"]').first();
  await expect(canvas).toBeVisible({ timeout: 10_000 });

  // Node count indicator shows visible nodes
  await expect(page.getByText(/\d+\/\d+ visible/)).toBeVisible({ timeout: 10_000 });
});
