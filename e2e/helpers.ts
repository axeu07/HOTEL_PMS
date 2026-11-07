import { expect, type Page } from '@playwright/test';

export type RoleKey = 'admin' | 'manager' | 'reception' | 'housekeeping';

const ROLE_NAME: Record<RoleKey, string> = {
  admin: 'Hotel Administrator',
  manager: 'General Manager',
  reception: 'Front Desk',
  housekeeping: 'Housekeeping',
};

/** Fails the test on any uncaught exception or console error. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

export async function signIn(page: Page, role: RoleKey) {
  await page.goto('/login');
  await page.getByRole('button', { name: `One-click sign in as ${ROLE_NAME[role]}` }).click();
  await expect(page).toHaveURL(/\/app\/dashboard/);
  // The dashboard pulls in the charts bundle, which can take over 10s when workers start together.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
}

export async function toast(page: Page, text: string | RegExp) {
  await expect(page.locator('.toast').filter({ hasText: text }).first()).toBeVisible();
}

export function dialog(page: Page, name: string | RegExp) {
  return page.getByRole('dialog', { name });
}

/** Stored value from the demo database, for asserting persisted state. */
export async function readDb<T>(page: Page, select: (db: Record<string, never[]>) => T): Promise<T> {
  const raw = await page.evaluate(() => localStorage.getItem('folio.demo.db'));
  return select(JSON.parse(raw!));
}

export function isoDays(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
