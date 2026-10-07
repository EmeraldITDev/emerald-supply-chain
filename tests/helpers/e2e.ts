import { expect, Page, APIRequestContext } from '@playwright/test';

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://emerald-supply-chain.vercel.app';
export const API_BASE_URL =
  process.env.PLAYWRIGHT_API_BASE_URL ??
  'https://supply-chain-backend-hwh6.onrender.com/api';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required env var: ${name}. Copy .env.example to .env and fill in test credentials.`,
    );
  }
  return value;
}

export const USERS = {
  asuku: {
    email: requireEnv('TEST_ASUKU_EMAIL'),
    password: requireEnv('TEST_ASUKU_PASSWORD'),
  },
  joseph: {
    email: requireEnv('TEST_JOSEPH_EMAIL'),
    password: requireEnv('TEST_JOSEPH_PASSWORD'),
  },
  viva: {
    email: requireEnv('TEST_VIVA_EMAIL'),
    password: requireEnv('TEST_VIVA_PASSWORD'),
  },
};

/** Unique tag per suite/file run for [TEST] isolation. */
export function makeRunId(prefix = 'PW'): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

export function localDatetimeOffset(daysFromNow: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localDateOffset(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function gotoApp(page: Page, path: string) {
  await page.goto(`${BASE_URL}${path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
}

export async function login(page: Page, email: string, password: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await gotoApp(page, '/auth');
    await page.locator('#email').fill(email);
    await page.locator('input[type="password"]').fill(password);

    await Promise.all([
      page.waitForURL(
        (url) =>
          /\/(dashboard|department|logistics|trip-request|supply-chain)/.test(url.pathname) &&
          !url.pathname.includes('/auth'),
        { timeout: 60_000 },
      ),
      page.getByRole('button', { name: 'Sign In' }).click({ noWaitAfter: true }),
    ]);

    await page.waitForTimeout(1500);
    if (!page.url().includes('/auth')) {
      await expect(page.getByRole('button', { name: 'Logout' }).first()).toBeVisible({
        timeout: 20_000,
      });
      return;
    }
    if (attempt === 2) {
      throw new Error(`Login failed for ${email} — still on /auth after sign-in`);
    }
  }
}

export async function logout(page: Page) {
  await page.keyboard.press('Escape').catch(() => undefined);
  await page.keyboard.press('Escape').catch(() => undefined);

  const logoutBtn = page.getByRole('button', { name: 'Logout' }).first();
  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click({ noWaitAfter: true, force: true });
    await page.waitForURL(/auth/, { timeout: 30_000 }).catch(() => undefined);
  }

  if (!page.url().includes('/auth')) {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await gotoApp(page, '/auth');
  }
}

/** Label + input pattern used across logistics forms (`div.space-y-2`). */
export function fieldInput(page: Page, label: string) {
  return page.locator('div.space-y-2').filter({ hasText: label }).locator('input, textarea').first();
}

export async function gotoLogisticsTab(
  page: Page,
  tab: 'overview' | 'trips' | 'journeys' | 'fleet' | 'gps' | 'materials' | 'movements' | 'reports' | 'accommodation',
) {
  await gotoApp(page, `/logistics?tab=${tab}`);
  await expect(page).toHaveURL(/logistics/, { timeout: 30_000 });
  const tabName =
    tab === 'accommodation'
      ? /^stays$/i
      : tab === 'movements'
        ? /^movements$/i
        : new RegExp(`^${tab}$`, 'i');
  const tabBtn = page.getByRole('tab', { name: tabName });
  if (await tabBtn.isVisible().catch(() => false)) {
    await tabBtn.click();
  }
}

export async function apiLogin(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${API_BASE_URL}/auth/login`, {
    data: { email, password },
    timeout: 60_000,
  });
  const body = await res.json();
  const token = body.token as string | undefined;
  if (!token) {
    throw new Error(`API login failed for ${email}: ${JSON.stringify(body).slice(0, 200)}`);
  }
  return token;
}

export async function warmApi(request: APIRequestContext) {
  await request.get(`${API_BASE_URL}/health`, { timeout: 90_000 }).catch(() => undefined);
}
