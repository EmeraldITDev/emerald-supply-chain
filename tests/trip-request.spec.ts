import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://emerald-supply-chain.vercel.app';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill in test credentials.`);
  }
  return value;
}

const USERS = {
  asuku: {
    email: requireEnv('TEST_ASUKU_EMAIL'),
    password: requireEnv('TEST_ASUKU_PASSWORD'),
    name: 'Asuku Onukaba',
  },
  joseph: {
    email: requireEnv('TEST_JOSEPH_EMAIL'),
    password: requireEnv('TEST_JOSEPH_PASSWORD'),
    name: 'Joseph Akinyanmi',
  },
};

const TEST_TRIP_TITLE = '[TEST] Playwright Automated Trip Request';

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/auth`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard|department|logistics/, { timeout: 15000 });
}

async function logout(page: Page) {
  // Click logout — adjust selector if needed
  await page.click('text=Logout');
  await page.waitForURL(/auth/, { timeout: 8000 });
}

// ─── TEST 1: Asuku creates a test trip request ───────────────────────────────
test('Asuku can create a test trip request', async ({ page }) => {
  await login(page, USERS.asuku.email, USERS.asuku.password);

  // Navigate to Trip Request
  await page.click('text=Trip Request');
  await page.waitForURL(/trip-request/, { timeout: 8000 });

  // Click New Trip Request
  await page.click('text=New Trip Request');
  await page.waitForSelector('form, [role="dialog"]', { timeout: 8000 });

  // Fill in the form
  await page.fill('input[placeholder*="purpose" i], input[name="purpose"], textarea[name="purpose"]',
    `${TEST_TRIP_TITLE} - Purpose`);

  await page.fill('input[placeholder*="destination" i], input[name="destination"]',
    '[TEST] Lagos Office');

  await page.fill('input[placeholder*="origin" i], input[name="origin"]',
    '[TEST] Calabar HQ');

  // Departure date — set to 7 days from now
  const departure = new Date();
  departure.setDate(departure.getDate() + 7);
  const departureStr = departure.toISOString().slice(0, 16);
  await page.fill('input[type="datetime-local"][name*="departure"]', departureStr);

  // Return date — set to 8 days from now
  const returnDate = new Date();
  returnDate.setDate(returnDate.getDate() + 8);
  const returnStr = returnDate.toISOString().slice(0, 16);
  await page.fill('input[type="datetime-local"][name*="arrival"], input[type="datetime-local"][name*="return"]',
    returnStr);

  // Take a screenshot before submitting
  await page.screenshot({ path: 'test-results/before-submit.png' });

  // Save as draft first to confirm form works
  const draftButton = page.locator('button:has-text("Save as Draft")');
  await draftButton.click();

  // Wait for success toast or redirect
  await page.waitForSelector(
    'text=Draft saved, text=saved successfully, [role="status"]',
    { timeout: 10000 }
  );

  await page.screenshot({ path: 'test-results/draft-saved.png' });
  console.log('✅ Trip request saved as draft successfully');

  await logout(page);
});

// ─── TEST 2: Asuku submits the draft ─────────────────────────────────────────
test('Asuku can submit the draft trip request', async ({ page }) => {
  await login(page, USERS.asuku.email, USERS.asuku.password);

  // Go to My Requests
  await page.goto(`${BASE_URL}/department`);
  await page.waitForLoadState('networkidle');

  // Find the test draft
  const draftRow = page.locator(`text=${TEST_TRIP_TITLE}`).first();
  await expect(draftRow).toBeVisible({ timeout: 10000 });

  // Click Submit on the draft
  const submitBtn = page.locator('button:has-text("Submit")').first();
  await submitBtn.click();

  // Confirm submission
  await page.waitForSelector(
    'text=submitted, text=success, [role="status"]',
    { timeout: 10000 }
  );

  await page.screenshot({ path: 'test-results/trip-submitted.png' });
  console.log('✅ Trip request submitted successfully');

  await logout(page);
});

// ─── TEST 3: Joseph (Logistics Manager) reviews the trip ─────────────────────
test('Joseph can see and review the test trip as Logistics Manager', async ({ page }) => {
  await login(page, USERS.joseph.email, USERS.joseph.password);

  // Go to Logistics
  await page.click('text=Logistics');
  await page.waitForURL(/logistics/, { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  // Look for the test trip
  const tripRow = page.locator(`text=${TEST_TRIP_TITLE}`).first();
  await expect(tripRow).toBeVisible({ timeout: 15000 });

  // Click View Details
  await page.locator(`text=${TEST_TRIP_TITLE}`)
    .locator('..').locator('..').locator('button:has-text("View Details")').click();

  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'test-results/logistics-trip-detail.png' });

  console.log('✅ Logistics Manager can see the test trip');

  await logout(page);
});
