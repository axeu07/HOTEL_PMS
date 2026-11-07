import { expect, test } from '@playwright/test';
import { dialog, readDb, signIn, watchErrors } from './helpers';

test.describe('guest occasions', () => {
  test('row shows real counts and opens a filtered list', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'admin');
    await page.goto('/app/customers/occasions');
    const db = await readDb(page, (d) => d.occasions as { type: string; reservationId: string | null }[]);
    expect(db.length).toBeGreaterThan(0);
    await expect(page.getByLabel('Guest occasions').first()).toBeVisible();
    const birthdays = await page.getByTestId('occasion-birthday').locator('.tier-count').innerText();
    expect(Number(birthdays)).toBeGreaterThan(0);
    await expect(page.locator('.ai-tabs').getByRole('link', { name: 'Guest Occasions' })).toBeVisible();
    await page.getByTestId('occasion-birthday').click();
    const d = page.getByTestId('occasion-list');
    await expect(d).toBeVisible();
    await expect(d.locator('tbody tr').first()).toContainText('Birthday');
    await d.getByRole('button', { name: 'Upcoming' }).click();
    await d.getByLabel('Occasion type').selectOption('anniversary');
    await expect(d.locator('tbody')).not.toContainText('Birthday');
    expect(errors).toEqual([]);
  });

  test('booking saves one occasion against the guest', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'admin');
    await page.goto('/app/front-desk?new=1');
    const form = dialog(page, /New booking/);
    await form.getByLabel('Guest', { exact: true }).click();
    await form.getByRole('option').first().click();
    await form.getByLabel(/What’s the occasion/).selectOption('birthday');
    await form.getByLabel('Occasion date').fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
    await form.getByLabel(/Whose birthday/).fill('Asha');
    const before = await readDb(page, (d) => (d.occasions as unknown[]).length);
    await form.getByRole('button', { name: 'Create booking' }).click();
    await expect.poll(() => readDb(page, (d) => (d.occasions as unknown[]).length)).toBe(before + 1);
    const saved = await readDb(page, (d) => (d.occasions as { celebrant: string; source: string; reservationId: string }[]).find((o) => o.celebrant === 'Asha'));
    expect(saved?.source).toBe('booking');
    expect(errors).toEqual([]);
  });

  test('check-in prefills the booking answer and updates it instead of adding another', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'admin');
    await page.goto('/app/front-desk?new=1');
    const form = dialog(page, /New booking/);
    await form.getByLabel('Guest', { exact: true }).click();
    await form.getByRole('option').first().click();
    await form.getByLabel(/What’s the occasion/).selectOption('anniversary');
    await form.getByLabel(/Whose anniversary/).fill('Ravi and Meena');
    await form.getByRole('button', { name: 'Create booking' }).click();
    await expect.poll(() => readDb(page, (d) => (d.occasions as { celebrant: string }[]).some((o) => o.celebrant === 'Ravi and Meena'))).toBe(true);
    const count = await readDb(page, (d) => (d.occasions as unknown[]).length);
    const res = await readDb(page, (d) => {
      const o = (d.occasions as { celebrant: string; reservationId: string }[]).find((x) => x.celebrant === 'Ravi and Meena')!;
      return o.reservationId;
    });
    await page.goto(`/app/reservations?open=${res}`);
    await page.getByRole('button', { name: /Check in/ }).first().click();
    const d = dialog(page, /Check in/);
    await expect(d.getByLabel(/Are you celebrating/)).toHaveValue('anniversary');
    await expect(d.getByLabel(/Whose anniversary/)).toHaveValue('Ravi and Meena');
    await d.getByLabel('Notes or preferences').fill('Champagne');
    await d.getByLabel('Room', { exact: true }).selectOption({ index: 1 });
    await d.getByLabel('ID number').fill('X123');
    await d.getByRole('button', { name: 'Complete check-in' }).click();
    await expect.poll(() => readDb(page, (db) => (db.occasions as { notes: string }[]).find((o) => o.notes === 'Champagne') ? 1 : 0)).toBe(1);
    expect(await readDb(page, (db) => (db.occasions as unknown[]).length)).toBe(count);
    expect(errors).toEqual([]);
  });
});
