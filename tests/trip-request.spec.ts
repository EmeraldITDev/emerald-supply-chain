import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://emerald-supply-chain.vercel.app';
const API_BASE_URL =
  process.env.PLAYWRIGHT_API_BASE_URL ??
  'https://supply-chain-backend-hwh6.onrender.com/api';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. Copy .env.example to .env and fill in test credentials.`,
    );
  }
  return value;
}

const USERS = {
  asuku: {
    email: requireEnv('TEST_ASUKU_EMAIL'),
    password: requireEnv('TEST_ASUKU_PASSWORD'),
  },
  joseph: {
    email: requireEnv('TEST_JOSEPH_EMAIL'),
    password: requireEnv('TEST_JOSEPH_PASSWORD'),
  },
};

const TEST_DESTINATION = '[TEST] Lagos Office Playwright';
const TEST_PURPOSE = '[TEST] Playwright Automated Trip Request - Purpose';
const TEST_ORIGIN = '[TEST] Calabar HQ';

/** These tests depend on each other (create → submit → review). */
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  await request.get(`${API_BASE_URL}/health`, { timeout: 90_000 }).catch(() => undefined);
});

/** datetime-local needs a local wall-clock value, not UTC ISO. */
function localDatetimeOffset(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(10, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function gotoApp(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
}

async function login(page: Page, email: string, password: string) {
  await gotoApp(page, '/auth');
  await page.locator('#email').fill(email);
  await page.locator('input[type="password"]').fill(password);

  await Promise.all([
    page.waitForURL(/dashboard|department|logistics|trip-request/, { timeout: 60_000 }),
    page.getByRole('button', { name: 'Sign In' }).click({ noWaitAfter: true }),
  ]);
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /logout/i }).or(page.getByText('Logout', { exact: true })).first().click({
    noWaitAfter: true,
  });
  await page.waitForURL(/auth/, { timeout: 30_000 });
}

function fieldInput(page: Page, label: string) {
  return page.locator('div.space-y-2').filter({ hasText: label }).locator('input, textarea').first();
}

// ─── TEST 1: Asuku creates a test trip request draft ─────────────────────────
test('Asuku can create a test trip request', async ({ page }) => {
  await login(page, USERS.asuku.email, USERS.asuku.password);

  await page.getByRole('link', { name: 'Trip Request' }).click();
  await page.waitForURL(/trip-request/, { timeout: 30_000 });

  // Default tab is already "New request" with the form visible.
  await expect(page.getByRole('heading', { name: 'New trip request' })).toBeVisible({
    timeout: 15_000,
  });

  await fieldInput(page, 'Origin').fill(TEST_ORIGIN);
  await fieldInput(page, 'Destination').fill(TEST_DESTINATION);
  await fieldInput(page, 'Purpose').fill(TEST_PURPOSE);

  // Out-of-state needs ≥7 lead days — use +10 to stay clear of timezone edge cases.
  const datetimeInputs = page.locator('input[type="datetime-local"]');
  await datetimeInputs.nth(0).fill(localDatetimeOffset(10));
  await datetimeInputs.nth(1).fill(localDatetimeOffset(11));

  await page.screenshot({ path: 'test-results/before-submit.png' });

  await page.getByRole('button', { name: /save as draft/i }).click();

  await expect(page.getByText(/draft saved/i).first()).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: 'test-results/draft-saved.png' });
  console.log('✅ Trip request saved as draft successfully');

  await logout(page);
});

// ─── TEST 2: Asuku submits the draft ─────────────────────────────────────────
test('Asuku can submit the draft trip request', async ({ page }) => {
  await login(page, USERS.asuku.email, USERS.asuku.password);

  await page.getByRole('link', { name: 'Trip Request' }).click();
  await page.waitForURL(/trip-request/, { timeout: 30_000 });

  await page.getByText('My trip requests', { exact: true }).click();

  // List cards live under the "My trip requests" panel.
  const draftCard = page
    .locator('.space-y-3 > *')
    .filter({ hasText: TEST_DESTINATION })
    .filter({ hasText: /draft/i })
    .first();
  await expect(draftCard).toBeVisible({ timeout: 30_000 });

  await draftCard.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: /edit trip request/i })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole('dialog').getByRole('button', { name: /submit trip request/i }).click();

  await expect(
    page.getByText(/trip request submitted|your request has been sent/i).first(),
  ).toBeVisible({ timeout: 30_000 });

  await page.screenshot({ path: 'test-results/trip-submitted.png' });
  console.log('✅ Trip request submitted successfully');

  await logout(page);
});

// ─── TEST 3: Joseph (Logistics Manager) reviews the trip ─────────────────────
test('Joseph can see and review the test trip as Logistics Manager', async ({ page }) => {
  await login(page, USERS.joseph.email, USERS.joseph.password);

  await page.getByRole('link', { name: 'Logistics' }).click();
  await page.waitForURL(/logistics/, { timeout: 30_000 });

  const tripRow = page.getByText(TEST_DESTINATION).first();
  await expect(tripRow).toBeVisible({ timeout: 30_000 });

  // Open details from the nearest actionable control if present.
  const details = page.getByRole('button', { name: /view details|view progress|view/i }).first();
  if (await details.isVisible().catch(() => false)) {
    await details.click();
  } else {
    await tripRow.click();
  }

  await page.screenshot({ path: 'test-results/logistics-trip-detail.png' });
  console.log('✅ Logistics Manager can see the test trip');

  await logout(page);
});
