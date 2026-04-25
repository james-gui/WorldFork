import { test, expect, type Locator, type Page } from '@playwright/test';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8003';
const GEMINI_FLASH_LITE = 'google/gemini-3.1-flash-lite-preview';

function collectBrowserProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (text.includes('Failed to load resource')) return;
    problems.push(text);
  });
  return problems;
}

async function chooseOption(page: Page, trigger: Locator, optionText: string) {
  await trigger.click();
  const option = page.getByRole('option').filter({ hasText: optionText });
  await expect(option).toBeVisible();
  await option.click();
}

test('app shell, command palette, theme, and placeholder controls do not break navigation', async ({ page }) => {
  const problems = collectBrowserProblems(page);

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings & Configuration' })).toBeVisible();

  await page.getByLabel('Open command palette (Cmd+K)').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByPlaceholder('Search pages and actions...')).toBeVisible();
  await dialog.getByPlaceholder('Search pages and actions...').fill('routing');
  await dialog.getByPlaceholder('Search pages and actions...').press('Enter');
  await expect(page).toHaveURL(/\/settings\/routing$/);

  await page.getByLabel('Collapse sidebar').click();
  await expect(page.getByLabel('Expand sidebar')).toBeVisible();
  await page.getByLabel('Expand sidebar').click();
  await expect(page.getByLabel('Collapse sidebar')).toBeVisible();

  const themeButton = page.getByRole('button', { name: /Switch to (dark|light) mode/ });
  await expect(themeButton).toBeVisible();
  await themeButton.click();
  await page.getByRole('button', { name: 'Notifications' }).click();
  await page.getByRole('button', { name: 'User menu' }).click();

  await page.goto('/docs');
  await expect(page.getByRole('heading', { name: 'WorldFork Documentation' })).toBeVisible();
  await page.getByPlaceholder('you@example.com').fill('qa@example.com');

  await page.goto('/sign-in');
  await page.getByLabel('Email').fill('qa@example.com');
  await page.getByLabel('Password').fill('not-a-real-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Auth coming soon')).toBeVisible();
  await expect(page.getByRole('button', { name: 'GitHub' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Google' })).toBeDisabled();

  expect(problems).toEqual([]);
});

test('create wizard supports safe parameter variation without mutating backend data', async ({ page }) => {
  let createRunBody: Record<string, unknown> | undefined;
  await page.route(`${API_BASE}/api/runs`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    createRunBody = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        run_id: 'run_e2e_noncritical',
        root_universe_id: 'uni_e2e_noncritical_root',
        status: 'initializing',
        job_id: 'job_e2e_noncritical',
        enqueued: true,
        degraded: false,
        error: null,
      }),
    });
  });

  await page.goto('/runs/new');
  await page.getByRole('button', { name: 'Try as example' }).click();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'scenario-notes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# QA notes\nPort scenario reference.'),
  });
  await expect(page.getByText('scenario-notes.md')).toBeVisible();
  await page.getByLabel('Remove scenario-notes.md').click();
  await expect(page.getByText('scenario-notes.md')).toHaveCount(0);

  await chooseOption(page, page.locator('#tickDuration'), '4 hours');
  const tickSlider = page.locator('[role="slider"]').first();
  await tickSlider.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByText('20 ticks × 4 hours = 3 days')).toBeVisible();

  await page.getByRole('button', { name: 'Advanced options' }).click();
  await page.getByLabel('Standard QSA mode').click();
  await page.getByLabel('Auto-fanout enabled').click();
  await page.locator('#estimatedLaunchTicks').fill('6');

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Data sources' })).toBeVisible();
  await page.getByLabel('Web search').click();
  await page.getByLabel('Uploaded documents').click();

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Model routing' })).toBeVisible();
  const initializerRow = page.locator('.rounded-lg').filter({ hasText: 'Initializer' }).filter({ hasText: 'Creates archetypes' }).first();
  const cohortRow = page.locator('.rounded-lg').filter({ hasText: 'Cohort decision' }).first();
  const heroRow = page.locator('.rounded-lg').filter({ hasText: 'Hero decision' }).first();
  await chooseOption(page, initializerRow.getByRole('combobox'), 'Gemini 3.1 Flash Lite');
  await chooseOption(page, cohortRow.getByRole('combobox'), 'Gemini 3.1 Flash Lite');
  await chooseOption(page, heroRow.getByRole('combobox'), 'Gemini 3.1 Flash Lite');

  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Review your configuration' })).toBeVisible();
  await expect(page.getByText('4 hours')).toBeVisible();
  await expect(page.getByText('20', { exact: true })).toBeVisible();
  await expect(page.getByText(GEMINI_FLASH_LITE).first()).toBeVisible();
  await expect(page.getByText('Web search')).toBeVisible();
  await expect(page.getByText('Uploaded docs')).toBeVisible();
  await expect(page.getByText('QSA mode').locator('..')).toContainText('Disabled');
  await expect(page.getByText('Auto-fanout').locator('..')).toContainText('Disabled');

  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Model routing' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();

  await page.getByRole('button', { name: 'Generate Big Bang' }).click();
  await expect.poll(() => createRunBody).toBeTruthy();
  expect(createRunBody).toMatchObject({
    tick_duration_minutes: 240,
    max_ticks: 20,
    max_schedule_horizon_ticks: 10,
    uploaded_doc_ids: [],
  });
  expect(String(createRunBody?.scenario_text)).toContain('gig-worker labor dispute');
});

test('routing, rate limit, and branch policy parameter variations send backend DTOs', async ({ page }) => {
  let routingPatch: Record<string, unknown> | undefined;
  let rateLimitPatch: Record<string, unknown> | undefined;
  let branchPolicyPatch: Record<string, unknown> | undefined;

  await page.route(`${API_BASE}/api/settings/model-routing`, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    const patch = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    routingPatch = patch;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: (patch.entries ?? []) }),
    });
  });
  await page.route(`${API_BASE}/api/settings/rate-limits`, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    const patch = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    rateLimitPatch = patch;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ rate_limits: (patch.rate_limits ?? []) }),
    });
  });
  await page.route(`${API_BASE}/api/settings/branch-policy`, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    const patch = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    branchPolicyPatch = patch;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        policy_id: 'policy_e2e',
        max_active_universes: patch.max_active_universes ?? 12,
        max_total_branches: patch.max_total_branches ?? 120,
        max_depth: patch.max_depth ?? 4,
        max_branches_per_tick: patch.max_branches_per_tick ?? 2,
        branch_cooldown_ticks: patch.branch_cooldown_ticks ?? 1,
        min_divergence_score: patch.min_divergence_score ?? 0.1,
        auto_prune_low_value: patch.auto_prune_low_value ?? false,
        payload: patch.payload ?? {},
      }),
    });
  });

  await page.goto('/settings/routing');
  await expect(page.getByText('force_deviation')).toBeVisible();
  await expect(page.getByText('aggregate_run_results')).toBeVisible();

  const initRow = page.getByRole('row').filter({ hasText: 'initialize_big_bang' });
  await chooseOption(page, initRow.getByRole('combobox').nth(1), GEMINI_FLASH_LITE);
  await initRow.getByRole('spinbutton').first().fill('0.2');
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect.poll(() => routingPatch).toBeTruthy();
  if (!routingPatch) throw new Error('Routing patch was not captured.');
  const entries = routingPatch.entries as Array<Record<string, unknown>>;
  expect(entries.some((entry) => entry.job_type === 'force_deviation')).toBe(true);
  expect(entries.some((entry) => entry.job_type === 'aggregate_run_results')).toBe(true);
  expect(entries.find((entry) => entry.job_type === 'initialize_big_bang')).toMatchObject({
    preferred_model: GEMINI_FLASH_LITE,
    temperature: 0.2,
  });

  const saveLimits = page.getByRole('button', { name: 'Save Limits' });
  await saveLimits.scrollIntoViewIfNeeded();
  const rateCard = page.locator('div').filter({ has: saveLimits }).filter({ hasText: 'Provider Rate Limits' }).first();
  const firstRateInput = rateCard.getByRole('spinbutton').first();
  if (await firstRateInput.count()) {
    await firstRateInput.fill('777');
  }
  await saveLimits.click();
  await expect.poll(() => rateLimitPatch).toBeTruthy();
  if (!rateLimitPatch) throw new Error('Rate-limit patch was not captured.');
  expect(rateLimitPatch.rate_limits).toEqual(expect.any(Array));

  await page.goto('/settings/branch-policy');
  await page.getByLabel('Toggle Auto Routing').click();
  await page.locator('[role="slider"]').first().focus();
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: 'Save as Template' }).click();
  await expect(page.getByText('Saved as template.')).toBeVisible();
  await page.getByRole('button', { name: 'Save Policy' }).click();
  await expect.poll(() => branchPolicyPatch).toBeTruthy();
  if (!branchPolicyPatch) throw new Error('Branch policy patch was not captured.');
  expect(branchPolicyPatch).toMatchObject({
    max_active_universes: expect.any(Number),
    max_total_branches: expect.any(Number),
    max_depth: expect.any(Number),
    max_branches_per_tick: expect.any(Number),
    branch_cooldown_ticks: expect.any(Number),
    min_divergence_score: expect.any(Number),
    payload: expect.any(Object),
  });
});

test('integrations, Zep-disabled surface, jobs filters, and log tabs handle non-critical controls', async ({ page }) => {
  let providerTest: Record<string, unknown> | undefined;
  let providersPatch: Record<string, unknown> | undefined;
  let webhookPayload: Record<string, unknown> | undefined;
  let zepPatch: Record<string, unknown> | undefined;

  await page.route(`${API_BASE}/api/settings/providers/test`, async (route) => {
    const payload = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    providerTest = payload;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, provider: payload.provider, model: payload.model, latency_ms: 12 }),
    });
  });
  await page.route(`${API_BASE}/api/settings/providers`, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    const patch = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    providersPatch = patch;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ providers: patch.providers ?? [] }),
    });
  });
  await page.route(`${API_BASE}/api/webhooks/test`, async (route) => {
    webhookPayload = JSON.parse(route.request().postData() ?? '{}');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, status_code: 200, latency_ms: 9, attempts: 1 }),
    });
  });
  await page.route(`${API_BASE}/api/integrations/zep`, async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.continue();
      return;
    }
    const patch = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    zepPatch = patch;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        setting_id: 'zep_e2e',
        enabled: false,
        mode: 'local',
        api_key_env: 'ZEP_API_KEY',
        cache_ttl_seconds: patch.cache_ttl_seconds ?? 300,
        degraded: false,
        payload: patch.payload ?? {},
      }),
    });
  });

  await page.goto('/settings/integrations');
  const providerCard = page.locator('.rounded-lg, .border').filter({ hasText: 'OpenRouter' }).first();
  await chooseOption(page, providerCard.getByRole('combobox'), GEMINI_FLASH_LITE);
  await providerCard.getByPlaceholder('https://...').fill('https://openrouter.ai/api/v1');
  await providerCard.getByRole('button', { name: 'Test connection' }).click();
  await expect(page.getByText('OpenRouter: connection test passed.')).toBeVisible();
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect.poll(() => providerTest).toBeTruthy();
  await expect.poll(() => providersPatch).toBeTruthy();
  if (!providerTest) throw new Error('Provider test payload was not captured.');
  if (!providersPatch) throw new Error('Providers patch was not captured.');
  expect(providerTest).toMatchObject({ provider: 'openrouter', model: GEMINI_FLASH_LITE });
  expect((providersPatch.providers as Array<Record<string, unknown>>)[0]).toMatchObject({
    provider: 'openrouter',
    default_model: GEMINI_FLASH_LITE,
  });

  await page.getByRole('button', { name: 'Send test' }).click();
  const webhookDialog = page.getByRole('dialog');
  await webhookDialog.getByLabel('Endpoint URL').fill('https://example.com/worldfork-webhook');
  await webhookDialog.getByLabel('Secret').fill('whsec_test_secret');
  await webhookDialog.getByText('branch.created').click();
  await webhookDialog.getByRole('button', { name: 'Send test webhook' }).click();
  await expect.poll(() => webhookPayload).toBeTruthy();
  expect(webhookPayload).toMatchObject({
    url: 'https://example.com/worldfork-webhook',
    secret: 'whsec_test_secret',
    event_type: 'branch.created',
  });

  await page.goto('/settings/zep');
  await expect(page.getByText('Zep is disabled for this deployment.')).toBeVisible();
  await expect(page.getByRole('combobox').first()).toBeDisabled();
  await expect(page.getByRole('combobox').nth(1)).toBeDisabled();
  await page.getByRole('tab', { name: 'Threads' }).click();
  await expect(page.getByText('Zep thread storage is disabled.')).toBeVisible();
  await page.getByRole('tab', { name: 'Graph' }).click();
  await expect(page.getByText('Zep graph sync is disabled for this deployment.')).toBeVisible();
  await page.getByRole('tab', { name: 'Search' }).click();
  await expect(page.getByText('Semantic Zep search is unavailable')).toBeVisible();
  await page.getByRole('tab', { name: 'History' }).click();
  await expect(page.getByText('No Zep sync history')).toBeVisible();
  await page.getByRole('button', { name: 'Save local mode' }).click();
  await expect.poll(() => zepPatch).toBeTruthy();
  if (!zepPatch) throw new Error('Zep patch was not captured.');
  expect(zepPatch).toMatchObject({ enabled: false, mode: 'local', api_key_env: 'ZEP_API_KEY' });

  await page.goto('/jobs');
  await page.getByPlaceholder('Search job ID, type, worker…').fill('aggregate');
  await chooseOption(page, page.getByRole('combobox').filter({ hasText: 'All queues' }), 'P2');
  await chooseOption(page, page.getByRole('combobox').filter({ hasText: 'All statuses' }), 'Failed');
  await chooseOption(page, page.getByRole('combobox').filter({ hasText: 'All types' }), 'Results');
  await chooseOption(page, page.getByRole('combobox').filter({ hasText: 'Last 1 hour' }), 'Last 24 hours');
  await page.locator('#auto-refresh').click();
  await page.locator('#heatmap-queue-toggle').click();
  await expect(page.getByRole('heading', { name: 'Background Jobs & Queue Monitor' })).toBeVisible();

  await page.goto('/logs');
  await page.getByRole('tab', { name: 'Webhooks' }).click();
  await page.getByRole('tab', { name: 'Errors' }).click();
  await page.getByRole('tab', { name: 'Requests' }).click();
  await expect(page.getByRole('heading', { name: 'API Logs & Webhooks' })).toBeVisible();
});
