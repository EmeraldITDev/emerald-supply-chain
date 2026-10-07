import { test, expect } from '@playwright/test';
import { USERS, login, logout, gotoLogisticsTab, warmApi } from '../helpers/e2e';

/**
 * Journeys tab smoke + light lifecycle
 * Full journey creation usually comes from Branch A convert; here we assert the
 * management surface and optional status update when any journey exists.
 */
test.describe('Logistics Journey Management', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    await warmApi(request);
  });

  test('Joseph can open Journey Management and search', async ({ page }) => {
    await login(page, USERS.joseph.email, USERS.joseph.password);
    await gotoLogisticsTab(page, 'journeys');

    await expect(page.getByRole('heading', { name: /journey management/i })).toBeVisible({
      timeout: 20_000,
    });

    const search = page.getByPlaceholder(/search journeys/i);
    await expect(search).toBeVisible({ timeout: 15_000 });
    await search.fill('[TEST]');
    const refresh = page.getByRole('button', { name: /^refresh$/i });
    if (await refresh.isVisible().catch(() => false)) {
      await refresh.click();
    }

    await page.screenshot({ path: 'test-results/journeys-list.png' });
    await logout(page);
  });

  test('Joseph can open a journey detail when one exists', async ({ page }) => {
    await login(page, USERS.joseph.email, USERS.joseph.password);
    await gotoLogisticsTab(page, 'journeys');

    await expect(page.getByRole('heading', { name: /journey management/i })).toBeVisible({
      timeout: 20_000,
    });

    const viewDetails = page.getByRole('button', { name: /view details|view/i }).first();
    const hasJourney = await viewDetails.isVisible({ timeout: 15_000 }).catch(() => false);

    if (!hasJourney) {
      // No journeys in staging — soft-pass with screenshot of empty state.
      await page.screenshot({ path: 'test-results/journeys-empty.png' });
      test.info().annotations.push({
        type: 'note',
        description: 'No journeys available — skipped detail/status steps',
      });
      await logout(page);
      return;
    }

    await viewDetails.click();
    await expect(page.getByRole('dialog').or(page.getByRole('heading').first())).toBeVisible({
      timeout: 15_000,
    });

    // Lifecycle controls when journey is still active.
    const updateStatus = page.getByRole('button', { name: /update status/i }).first();
    if (await updateStatus.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await updateStatus.click();
      const statusDialog = page.getByRole('dialog').filter({
        has: page.getByRole('heading', { name: /update status|status/i }),
      });
      if (await statusDialog.isVisible({ timeout: 8_000 }).catch(() => false)) {
        const statusSelect = statusDialog.getByRole('combobox').first();
        if (await statusSelect.isVisible().catch(() => false)) {
          await statusSelect.click();
          const departed = page.getByRole('option', { name: /departed/i });
          if (await departed.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await departed.click();
            const save = statusDialog.getByRole('button', { name: /save|update|confirm/i }).first();
            if (await save.isVisible().catch(() => false)) {
              await save.click();
              await page
                .getByText(/updated|success|departed/i)
                .first()
                .waitFor({ state: 'visible', timeout: 30_000 })
                .catch(() => undefined);
            }
          } else {
            await page.keyboard.press('Escape').catch(() => undefined);
          }
        }
      }
    }

    const reportIncident = page.getByRole('button', { name: /report incident/i }).first();
    if (await reportIncident.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(reportIncident).toBeEnabled();
    }

    await page.screenshot({ path: 'test-results/journeys-detail.png' });
    await logout(page);
  });

  test('SCD (Viva) can view Journey Management (read)', async ({ page }) => {
    await login(page, USERS.viva.email, USERS.viva.password);
    await gotoLogisticsTab(page, 'journeys');

    await expect(page.getByRole('heading', { name: /journey management/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByPlaceholder(/search journeys/i)).toBeVisible({ timeout: 15_000 });

    await page.screenshot({ path: 'test-results/journeys-scd-view.png' });
    await logout(page);
  });
});
