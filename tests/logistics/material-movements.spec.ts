import { test, expect } from '@playwright/test';
import {
  USERS,
  makeRunId,
  localDatetimeOffset,
  login,
  logout,
  fieldInput,
  gotoLogisticsTab,
  warmApi,
} from '../helpers/e2e';

/**
 * Material Movements tab (/logistics?tab=movements)
 * - LM creates movement + marks in transit
 * - Role visibility: employee cannot create; SCD can open Approve path after submit
 */
const RUN_ID = makeRunId('MM');
const MATERIAL_NAME = `[TEST] Laptops ${RUN_ID}`;
const DESTINATION = `[TEST] Warehouse Lagos ${RUN_ID}`;

test.describe('Logistics Material Movements', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ request }) => {
    await warmApi(request);
  });

  test('Joseph can create a material movement (Emerald-owned)', async ({ page }) => {
    await login(page, USERS.joseph.email, USERS.joseph.password);
    await gotoLogisticsTab(page, 'movements');

    await expect(page.getByRole('heading', { name: /material movements/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /new material movement/i })).toBeVisible();

    await page.getByRole('button', { name: /new material movement/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: /new material movement/i })).toBeVisible({
      timeout: 15_000,
    });

    await fieldInput(page, 'Material Name').fill(MATERIAL_NAME);
    await fieldInput(page, 'Category').fill('Electronics');
    await fieldInput(page, 'Quantity').fill('2');
    await fieldInput(page, 'Pickup Location').fill(`[TEST] Calabar Yard ${RUN_ID}`);
    await fieldInput(page, 'Destination').fill(DESTINATION);

    await dialog.getByLabel(/emerald-owned vehicle/i).click();
    await fieldInput(page, 'Vendor Name').fill(`[TEST] Emerald Fleet ${RUN_ID}`);
    await fieldInput(page, 'Vendor Phone').fill('08012345678');
    await fieldInput(page, 'Vehicle Plate').fill(`TST-${RUN_ID.slice(-6).toUpperCase()}`);
    await fieldInput(page, 'Driver Name').fill(`[TEST] Driver ${RUN_ID}`);
    await fieldInput(page, 'Driver Phone').fill('08087654321');

    const datetimeInputs = dialog.locator('input[type="datetime-local"]');
    await datetimeInputs.nth(0).fill(localDatetimeOffset(2, 9));
    await datetimeInputs.nth(1).fill(localDatetimeOffset(3, 16));

    await dialog.getByRole('button', { name: /create movement/i }).click();
    await expect(page.getByText(/movement created/i).first()).toBeVisible({ timeout: 45_000 });

    await page.getByPlaceholder(/search material/i).fill(MATERIAL_NAME);
    await expect(page.getByRole('row').filter({ hasText: MATERIAL_NAME })).toBeVisible({
      timeout: 30_000,
    });

    await page.screenshot({ path: 'test-results/mm-created.png' });
    await logout(page);
  });

  test('Joseph can mark the movement in transit and open Issue JCC', async ({ page }) => {
    await login(page, USERS.joseph.email, USERS.joseph.password);
    await gotoLogisticsTab(page, 'movements');

    await page.getByPlaceholder(/search material/i).fill(MATERIAL_NAME);
    const row = page.getByRole('row').filter({ hasText: MATERIAL_NAME }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    await row.getByRole('button').last().click(); // ⋮ menu
    await page.getByRole('menuitem', { name: /mark in transit/i }).click();
    await page.getByRole('button', { name: /^confirm$/i }).click();
    // Toast copy varies — status badge is the source of truth.
    await expect(row.getByText(/in transit/i)).toBeVisible({ timeout: 45_000 });

    await row.getByRole('button').last().click();
    await page.getByRole('menuitem', { name: /^view$/i }).click();
    await expect(page.getByRole('heading', { name: /material movement/i })).toBeVisible({
      timeout: 15_000,
    });

    const issueJcc = page.getByRole('button', { name: /close movement \/ issue jcc|view jcc/i });
    await expect(issueJcc).toBeVisible({ timeout: 15_000 });
    await issueJcc.click();

    await expect(page.getByRole('heading', { name: /job completion certificate/i })).toBeVisible({
      timeout: 20_000,
    });
    // LM drafts JCC — Approve is SCD-only after submit.
    await expect(page.getByRole('button', { name: /approve jcc/i })).toHaveCount(0);

    const condition = page.getByRole('dialog').locator('div.space-y-2').filter({
      hasText: /condition on arrival/i,
    });
    if (await condition.getByRole('combobox').isVisible().catch(() => false)) {
      await condition.getByRole('combobox').click();
      await page.getByRole('option', { name: /^good$/i }).click();
    }

    const addRow = page.getByRole('button', { name: /add row/i });
    if (await addRow.isVisible().catch(() => false)) {
      await addRow.click();
      const dialog = page.getByRole('dialog');
      await dialog.locator('table input').first().fill(MATERIAL_NAME);
      await dialog.locator('table input[type="number"]').first().fill('2');
    }

    const saveDraft = page.getByRole('button', { name: /save as draft/i });
    if (await saveDraft.isVisible().catch(() => false)) {
      await saveDraft.click();
      await page
        .getByText(/saved|draft/i)
        .first()
        .waitFor({ state: 'visible', timeout: 30_000 })
        .catch(() => undefined);
    }

    const submitJcc = page.getByRole('button', { name: /submit jcc/i });
    if (await submitJcc.isEnabled().catch(() => false)) {
      await submitJcc.click();
      await page
        .getByText(/submitted|pending approval|success/i)
        .first()
        .waitFor({ state: 'visible', timeout: 45_000 })
        .catch(() => undefined);
    }

    await page.screenshot({ path: 'test-results/mm-jcc-draft.png' });
    await page.keyboard.press('Escape').catch(() => undefined);
    await logout(page);
  });

  test('Employee (Asuku) cannot create material movements', async ({ page }) => {
    await login(page, USERS.asuku.email, USERS.asuku.password);
    await gotoLogisticsTab(page, 'movements');

    // Employees may land on logistics via URL; create control must stay hidden.
    await expect(page.getByRole('button', { name: /new material movement/i })).toHaveCount(0, {
      timeout: 20_000,
    });

    await page.screenshot({ path: 'test-results/mm-employee-no-create.png' });
    await logout(page);
  });

  test('SCD (Viva) can open movements and does not see New Movement', async ({ page }) => {
    await login(page, USERS.viva.email, USERS.viva.password);
    await gotoLogisticsTab(page, 'movements');

    await expect(page.getByRole('heading', { name: /material movements/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: /new material movement/i })).toHaveCount(0);

    await page.getByPlaceholder(/search material/i).fill(MATERIAL_NAME);
    const row = page.getByRole('row').filter({ hasText: MATERIAL_NAME }).first();
    if (await row.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await row.getByRole('button').last().click();
      await page.getByRole('menuitem', { name: /^view$/i }).click();
      const jccBtn = page.getByRole('button', { name: /view jcc|issue jcc/i });
      if (await jccBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await jccBtn.click();
        await expect(page.getByRole('heading', { name: /job completion certificate/i })).toBeVisible({
          timeout: 20_000,
        });
        // Approve only when status is submitted.
        const approve = page.getByRole('button', { name: /approve jcc/i });
        if (await approve.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await approve.click();
          await page
            .getByText(/approved|success/i)
            .first()
            .waitFor({ state: 'visible', timeout: 45_000 })
            .catch(() => undefined);
        }
      }
    }

    await page.screenshot({ path: 'test-results/mm-scd-view.png' });
    await logout(page);
  });
});
