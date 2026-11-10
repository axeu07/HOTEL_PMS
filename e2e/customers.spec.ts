import { expect, test } from '@playwright/test';
import { dialog, readDb, signIn, toast, watchErrors } from './helpers';

test.describe('customers', () => {
  test('sidebar lists the hotel modules alongside the CRM, in order, and each opens', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'admin');
    const nav = page.locator('.sidebar nav');

    // One entry per row, top to bottom: ordinary links, plus the Property group's toggle.
    const rows = nav.locator('> .nav-link .nav-label, > .nav-group > .nav-group-toggle .nav-label');
    await expect(rows).toHaveText([
      'Dashboard', 'Customers', 'Quick Actions', 'Front Desk', 'Reservations', 'Property',
      'Restaurant', 'Finance / Billing', 'Reports', 'Staff', 'Settings', 'AI Insights',
    ]);

    // Every single-page row leads to its own screen. Property's pages are covered in interaction.spec.ts.
    const routes: [string, RegExp][] = [
      ['Quick Actions', /quick-actions/], ['Front Desk', /front-desk/], ['Reservations', /reservations/],
      ['Restaurant', /restaurant/], ['Finance / Billing', /billing/], ['Reports', /reports/],
      ['Staff', /staff/], ['Settings', /settings/], ['Customers', /customers\/stayed/], ['AI Insights', /ai\/overview/], ['Dashboard', /dashboard/],
    ];
    for (const [name, url] of routes) {
      // AI Insights carries a "New" badge in its accessible name.
      await nav.getByRole('link', { name: new RegExp(`^${name}( New)?$`) }).click();
      await expect(page).toHaveURL(url);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText('Not part of this role')).toHaveCount(0);
    }

    // The CRM is still reached through Customers, and its tabs still work.
    await nav.getByRole('link', { name: 'Customers', exact: true }).click();
    await page.getByRole('navigation', { name: 'Customers' }).getByRole('link', { name: 'Leads' }).click();
    await expect(page).toHaveURL(/customers\/leads/);
    expect(errors).toEqual([]);
  });

  test('dashboard is lead focused', async ({ page }) => {
    await signIn(page, 'admin');
    await expect(page.getByTestId('kpi-total-leads')).toHaveText(/\d+/);
    await expect(page.getByTestId('kpi-conversion')).toHaveText(/%/);
    await expect(page.getByRole('button', { name: 'Send campaign' })).toBeVisible();
    await expect(page.getByTestId('kpi-revenue')).toBeVisible(); // operations still below
  });

  test('stayed guests carry loyalty tiers and open WhatsApp / email messages', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/customers/stayed');
    await expect(page.locator('.tier-card')).toHaveCount(4);
    await page.getByLabel('Loyalty tier', { exact: true }).selectOption('vip');
    await expect(page.locator('tbody .badge-brass').first()).toHaveText('VIP');
    await page.locator('tbody tr').first().getByTestId('contact-whatsapp').click();
    const d = dialog(page, /Message/);
    await expect(d).toBeVisible();
    await expect(d.locator('.wa-bubble')).toContainText('HOTEL PMS');
    const link = d.getByTestId('open-whatsapp');
    await expect(link).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/);
    await link.evaluate((a) => a.addEventListener('click', (e) => e.preventDefault()));
    await link.click();
    await expect(d.getByText('Opened', { exact: true })).toBeVisible();
    await d.getByRole('button', { name: 'Email' }).click();
    await expect(d.locator('.mail-head')).toContainText('Subject');
  });

  test('bulk selection builds a campaign for each guest', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/customers/stayed');
    await page.locator('tbody .row-check').nth(0).check();
    await page.locator('tbody .row-check').nth(1).check();
    await page.getByRole('button', { name: 'Birthday offer' }).click();
    await expect(dialog(page, /Birthday offer for 2 guests/)).toBeVisible();
    await expect(page.locator('.recipient-list li')).toHaveCount(2);
  });

  test('a lead gets a personal link, books through it, and is tracked as converted', async ({ page, context }) => {
    await signIn(page, 'admin');
    await page.goto('/app/customers/leads');
    await page.getByRole('button', { name: 'Add lead' }).click();
    const form = dialog(page, 'Add a lead');
    await form.getByLabel('Name').fill('Ishita Verma');
    await form.getByLabel('Phone').fill('+91 98111 22334');
    await form.getByLabel('Email').fill('ishita.verma@example.com');
    await form.getByRole('button', { name: 'Add lead' }).click();
    await toast(page, 'added to leads');

    await page.getByRole('button', { name: 'Generate booking link for Ishita Verma' }).click();
    const modal = dialog(page, 'Personal booking link');
    const url = await modal.getByLabel('Booking link').inputValue();
    expect(url).toMatch(/\/book\/bk[a-z0-9]{8,}$/);

    const guest = await context.newPage();
    await guest.goto(url);
    await expect(guest.getByRole('heading', { name: /Hello Ishita/ })).toBeVisible();
    await guest.getByTestId('booking-form').getByRole('button', { name: 'Request this stay' }).click();
    await expect(guest.getByTestId('booking-done')).toBeVisible();
    const code = await guest.getByTestId('booking-code').innerText();
    await guest.close();

    const lead = await readDb(page, (db) => (db.leads as { name: string; status: string; reservationId: string | null; linkOpenedAt: string | null }[]).find((l) => l.name === 'Ishita Verma'));
    expect(lead?.status).toBe('converted');
    expect(lead?.reservationId).toBeTruthy();
    expect(lead?.linkOpenedAt).toBeTruthy();
    const res = await readDb(page, (db) => (db.reservations as { code: string; source: string; status: string }[]).find((r) => r.code === code));
    expect(res).toMatchObject({ source: 'lead_link', status: 'pending' });

    // Reopening the link does not book twice.
    const again = await context.newPage();
    await again.goto(url);
    await expect(again.getByTestId('booking-done')).toBeVisible();
  });

  test('an invalid booking link is refused', async ({ page }) => {
    await page.goto('/book/notarealtoken1');
    await expect(page.getByTestId('booking-invalid')).toBeVisible();
  });

  test('templates: preview, edit a built-in, create and delete a custom one', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/customers/templates');
    await expect(page.getByTestId('template-card')).toHaveCount(8);
    await page.getByRole('tab', { name: /Email templates/ }).click();
    await expect(page.getByTestId('template-card')).toHaveCount(8);
    await page.getByRole('tab', { name: /WhatsApp templates/ }).click();

    await page.getByRole('button', { name: 'New WhatsApp template' }).click();
    const d = dialog(page, /New WhatsApp template/);
    await d.getByLabel('Template name').fill('Late checkout offer');
    await d.getByLabel('WhatsApp message').fill('Hi {guest_name}, enjoy a late checkout at {hotel_name}.');
    await d.getByRole('button', { name: '{room_type}' }).click();
    await expect(d.locator('.wa-bubble')).toContainText('Hi Priya');
    await d.getByRole('button', { name: 'Create template' }).click();
    await expect(page.getByTestId('template-card')).toHaveCount(9);

    await page.getByTestId('template-card').filter({ hasText: 'Late checkout offer' }).click();
    await dialog(page, 'Late checkout offer').getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete template' }).click();
    await expect(page.getByTestId('template-card')).toHaveCount(8);

    // Unknown placeholders are refused.
    await page.getByTestId('template-card').first().click();
    const edit = page.getByRole('dialog');
    await edit.getByLabel('WhatsApp message').fill('Hello {guestname}');
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await expect(edit.getByRole('alert').first()).toContainText('guestname');
  });

  test('front desk keeps booking tools and lists every booking', async ({ page }) => {
    await signIn(page, 'reception');
    await page.goto('/app/front-desk');
    await expect(page.getByRole('button', { name: 'Walk-in booking' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New reservation' })).toBeVisible();
    await page.getByRole('tab', { name: /All bookings/ }).click();
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await page.getByRole('button', { name: 'New reservation' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('housekeeping has no customer pages', async ({ page }) => {
    await signIn(page, 'housekeeping');
    await expect(page.locator('.sidebar nav').getByText('Customers')).toHaveCount(0);
    await page.goto('/app/customers/leads');
    await expect(page.getByText('Not part of this role')).toBeVisible();
  });
});
