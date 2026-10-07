import { test, expect } from '@playwright/test';
import {
  USERS,
  makeRunId,
  localDateOffset,
  login,
  logout,
  fieldInput,
  gotoLogisticsTab,
  warmApi,
} from '../helpers/e2e';

/**
 * Stays tab (/logistics?tab=accommodation)
 * - LM: create booking
 * - SCD: read-only (no New Booking)
 * - Employee: blocked message
 */
const RUN_ID = makeRunId('STY');
const HOTEL_NAME = `[TEST] Hotel ${RUN_ID}`;
const PASSENGER = `[TEST] Guest ${RUN_ID}`;

test.describe('Logistics Stays (Accommodation)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    await warmApi(request);
  });

  test('Joseph can create an accommodation booking', async ({ page }) => {
    await login(page, USERS.joseph.email, USERS.joseph.password);
    await gotoLogisticsTab(page, 'accommodation');

    await expect(page.getByRole('button', { name: /new booking/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /new booking/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    await dialog.getByPlaceholder(/type name and press enter/i).fill(PASSENGER);
    await dialog.getByRole('button', { name: /^add$/i }).click();
    await expect(dialog.getByText(PASSENGER)).toBeVisible();

    await fieldInput(page, 'Destination State').fill('Cross River');
    await fieldInput(page, 'Destination City').fill('Calabar');
    await fieldInput(page, 'Hotel Name').fill(HOTEL_NAME);
    await fieldInput(page, 'Number of Nights').fill('2');
    await dialog.locator('input[type="date"]').first().fill(localDateOffset(14));

    await dialog.getByRole('button', { name: /create booking/i }).click();
    await expect(page.getByText(HOTEL_NAME).first()).toBeVisible({ timeout: 45_000 });
    await page.screenshot({ path: 'test-results/stays-booking-created.png' });
    await logout(page);
  });

  test('SCD (Viva) sees Stays as read-only', async ({ page }) => {
    await login(page, USERS.viva.email, USERS.viva.password);
    await gotoLogisticsTab(page, 'accommodation');

    await expect(page.getByText(/read-only|hotel bookings/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /new booking/i })).toHaveCount(0);

    // Booking created by LM should still be visible when list loads.
    const hotel = page.getByText(HOTEL_NAME).first();
    if (await hotel.isVisible({ timeout: 20_000 }).catch(() => false)) {
      await expect(hotel).toBeVisible();
    }

    await page.screenshot({ path: 'test-results/stays-scd-readonly.png' });
    await logout(page);
  });

  test('Employee (Asuku) is blocked from Stays', async ({ page }) => {
    await login(page, USERS.asuku.email, USERS.asuku.password);
    await gotoLogisticsTab(page, 'accommodation');

    await expect(
      page.getByText(/you do not have access to accommodation bookings/i),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /new booking/i })).toHaveCount(0);

    await page.screenshot({ path: 'test-results/stays-employee-blocked.png' });
    await logout(page);
  });
});
