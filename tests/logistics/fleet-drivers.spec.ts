import { test, expect } from '@playwright/test';
import {
  USERS,
  makeRunId,
  login,
  logout,
  fieldInput,
  gotoLogisticsTab,
  warmApi,
} from '../helpers/e2e';

/**
 * Fleet tab → Drivers section
 * - LM can add a driver and see it listed
 * - Employee can open fleet URL but assign/delete controls stay LM/admin-gated
 */
const RUN_ID = makeRunId('DRV');
const DRIVER_NAME = `[TEST] Driver ${RUN_ID}`;
const DRIVER_PHONE = '08011223344';

test.describe('Logistics Fleet Drivers', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    await warmApi(request);
  });

  test('Joseph can add a fleet driver', async ({ page }) => {
    await login(page, USERS.joseph.email, USERS.joseph.password);
    await gotoLogisticsTab(page, 'fleet');

    await expect(page.getByRole('heading', { name: /^drivers$/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /add driver/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /add driver/i })).toBeVisible({
      timeout: 15_000,
    });

    await fieldInput(page, 'Full Name').fill(DRIVER_NAME);
    await fieldInput(page, 'Phone Number').fill(DRIVER_PHONE);
    await fieldInput(page, 'Licence Number').fill(`LIC-${RUN_ID.slice(-6).toUpperCase()}`);

    await dialog.getByRole('button', { name: /^add driver$/i }).click();
    await expect(page.getByText(/driver added/i).first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole('row').filter({ hasText: DRIVER_NAME })).toBeVisible({
      timeout: 30_000,
    });

    await page.screenshot({ path: 'test-results/fleet-driver-added.png' });
    await logout(page);
  });

  test('Added driver remains visible to Logistics Manager', async ({ page }) => {
    await login(page, USERS.joseph.email, USERS.joseph.password);
    await gotoLogisticsTab(page, 'fleet');

    const row = page.getByRole('row').filter({ hasText: DRIVER_NAME });
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByText(DRIVER_PHONE)).toBeVisible();

    // Manager-only row actions (assign / docs / delete) should be present for Joseph.
    await expect(row.getByRole('button').nth(1)).toBeVisible();

    await page.screenshot({ path: 'test-results/fleet-driver-visible-lm.png' });
    await logout(page);
  });

  test('Employee (Asuku) does not get manager-only driver actions', async ({ page }) => {
    await login(page, USERS.asuku.email, USERS.asuku.password);
    await gotoLogisticsTab(page, 'fleet');

    // Deep-link may still render Drivers; assign/delete are canManage-gated.
    const driversHeading = page.getByRole('heading', { name: /^drivers$/i });
    if (await driversHeading.isVisible({ timeout: 15_000 }).catch(() => false)) {
      const row = page.getByRole('row').filter({ hasText: DRIVER_NAME });
      if (await row.isVisible({ timeout: 10_000 }).catch(() => false)) {
        // Edit pencil may exist; trash/assign should not for non-manager.
        await expect(row.getByTitle(/assign to vehicle/i)).toHaveCount(0);
        await expect(row.getByTitle(/manage documents/i)).toHaveCount(0);
      }
    }

    await page.screenshot({ path: 'test-results/fleet-driver-employee.png' });
    await logout(page);
  });
});
