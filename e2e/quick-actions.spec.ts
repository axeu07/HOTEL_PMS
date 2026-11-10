import { expect, test, type Page } from '@playwright/test';
import { dialog, isoDays, signIn, toast, watchErrors, type RoleKey } from './helpers';

/** Deadlines depend on the hour, so these run at a fixed 13:00: past check-out, morning shift under way. */
async function atOnePm(page: Page) {
  await page.clock.setFixedTime(new Date(`${isoDays(0)}T13:00:00`));
}

const readDb = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('folio.demo.db')!));

const count = async (page: Page, testId: string) => Number(await page.getByTestId(testId).innerText());

/* The rules restated independently of the app, to check its counts against the raw records. */
function expected(db: any) {
  const now = isoDays(0);
  const active = new Set(db.staff.filter((s: any) => s.active).map((s: any) => s.id));
  const graceEnds: Record<string, string> = { Morning: `${now}T06:15:00`, Evening: `${now}T14:15:00`, Night: `${now}T22:15:00` };
  const clockNow = new Date(`${now}T13:00:00`).getTime();
  const absent = db.duties.filter((d: any) => {
    if (d.date !== now || !active.has(d.staffId)) return false;
    const record = db.attendance.find((a: any) => a.dutyId === d.id);
    const arrived = record && new Date(record.clockedInAt).getTime() <= clockNow;
    return !arrived && new Date(graceEnds[d.shift]).getTime() < clockNow;
  });
  const inHouse = db.reservations.filter((r: any) => r.status === 'checked_in');
  return {
    roomsToClean: db.rooms.filter((r: any) => r.status === 'vacant' && r.cleaning !== 'clean').length,
    absent: absent.length,
    overdue: inHouse.filter((r: any) => r.checkOut === now).length,
    unchecked: inHouse.filter((r: any) => r.checkOut < now).length,
  };
}

for (const role of ['admin', 'manager'] as RoleKey[]) {
  test.describe(`quick actions as ${role}`, () => {
    test.beforeEach(async ({ page }) => {
      await atOnePm(page);
      await signIn(page, role);
    });

    test('the dashboard row sits above the KPIs with counts that match the records', async ({ page }) => {
      const errors = watchErrors(page);
      const row = page.locator('.qa-section');
      await expect(row.getByRole('heading', { name: 'Quick Actions' })).toBeVisible();
      await expect(row.locator('.qa-card')).toHaveCount(4);

      const rowBox = (await row.boundingBox())!;
      const kpiBox = (await page.getByTestId('kpi-occupancy').boundingBox())!;
      expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(kpiBox.y);

      // One line on a desktop.
      const tops = await row.locator('.qa-card').evaluateAll((cards) => cards.map((c) => c.getBoundingClientRect().top));
      expect(new Set(tops).size).toBe(1);

      const want = expected(await readDb(page));
      await expect(page.getByTestId('qa-count-rooms-to-clean')).toHaveText(String(want.roomsToClean));
      await expect(page.getByTestId('qa-count-absent')).toHaveText(String(want.absent));
      await expect(page.getByTestId('qa-count-overdue-checkout')).toHaveText(String(want.overdue));
      await expect(page.getByTestId('qa-count-unchecked-room')).toHaveText(String(want.unchecked));
      for (const n of [want.roomsToClean, want.absent, want.overdue, want.unchecked]) expect(n).toBeGreaterThan(0);

      // Existing KPIs are untouched and agree with the row.
      await expect(page.getByTestId('kpi-total-rooms')).toHaveText('48');
      await expect(page.getByText(`Plus ${want.roomsToClean} awaiting cleaning`)).toBeVisible();
      expect(errors).toEqual([]);
    });

    test('Quick Actions is in the sidebar, and View All opens the same page', async ({ page }) => {
      await expect(page.locator('.sidebar').getByRole('link', { name: 'Quick Actions' })).toHaveCount(1);

      // The dashboard opens on the Leads tab; the Quick Actions cards sit on the Sales tab.
      await page.getByRole('tab', { name: 'Sales' }).click();
      await page.locator('.qa-section').getByRole('link', { name: 'View All' }).click();
      await expect(page).toHaveURL(/\/app\/quick-actions$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Quick Actions' })).toBeVisible();

      for (const name of ['Housekeeping', 'Staff', 'Front Desk', 'Maintenance', 'Finance', 'Guest Experience']) {
        await expect(page.getByRole('tab', { name: new RegExp(`^${name}`) })).toBeVisible();
      }
    });

    test('each dashboard card opens its filtered list with the same count', async ({ page }) => {
      const cards = [
        ['rooms-to-clean', /category=housekeeping&focus=rooms-to-clean/],
        ['absent', /category=staff&focus=absent/],
        ['overdue-checkout', /category=front-desk&focus=overdue-checkout/],
        ['unchecked-room', /category=front-desk&focus=unchecked-room/],
      ] as const;
      for (const [key, url] of cards) {
        await page.goto('/app/dashboard');
        const shown = await page.getByTestId(`qa-count-${key}`).innerText();
        await page.getByTestId(`qa-card-${key}`).click();
        await expect(page).toHaveURL(url);
        const open = (await count(page, 'qa-status-count-urgent')) + (await count(page, 'qa-status-count-pending'));
        expect(open, key).toBe(Number(shown));
        await expect(page.locator('.qa-item:not([data-resolved])')).toHaveCount(Number(shown));
      }
    });

    test('the status filters split All into Urgent, Pending and Resolved', async ({ page }) => {
      await page.goto('/app/quick-actions');
      await expect(page.getByTestId('qa-status-count-all')).toBeVisible();
      const [all, urgent, pending, resolved] = await Promise.all(['all', 'urgent', 'pending', 'resolved'].map((s) => count(page, `qa-status-count-${s}`)));
      expect(urgent + pending + resolved).toBe(all);
      expect(urgent).toBeGreaterThan(0);

      await page.getByRole('button', { name: /^Urgent/ }).click();
      await expect(page).toHaveURL(/status=urgent/);
      await expect(page.locator('.qa-item[data-priority="normal"], .qa-item[data-priority="low"]')).toHaveCount(0);
      await expect(page.locator('.qa-item[data-resolved]')).toHaveCount(0);

      await page.getByRole('button', { name: /^Pending/ }).click();
      await expect(page.locator('.qa-item[data-priority="high"]')).toHaveCount(0);

      await page.getByRole('button', { name: /^Resolved/ }).click();
      await expect(page.locator('.qa-item:not([data-resolved])')).toHaveCount(0);
    });

    test('no record raises the same alert twice, across any list', async ({ page }) => {
      await page.goto('/app/quick-actions');
      await page.getByTestId('qa-status-count-all').waitFor();
      // Each press renames its button, so always take the first one left.
      const more = page.getByRole('button', { name: /^Show all/ });
      while (await more.count()) await more.first().click();
      const ids = await page.locator('.qa-item').evaluateAll((items) => items.map((i) => i.getAttribute('data-testid')));
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);

      // One stay, one front-of-house action, even though it could qualify for several lists.
      const links = await page.locator('.qa-category:has(h2:text("Front Desk")) .qa-item-title a, .qa-category:has(h2:text("Guest Experience")) .qa-item-title a').evaluateAll((els) =>
        els.map((el) => el.getAttribute('href')).filter((h) => h?.includes('/app/reservations')));
      expect(new Set(links).size).toBe(links.length);
    });

    test('marking someone arrived clears the alert and updates every count', async ({ page }) => {
      const before = await count(page, 'qa-count-absent');
      await page.goto('/app/quick-actions?category=staff&focus=absent');
      const row = page.locator('.qa-item').first();
      const name = (await row.locator('.qa-item-title a').innerText()).trim();
      const resolvedBefore = await count(page, 'qa-status-count-resolved');
      await row.getByRole('button', { name: 'Mark arrived' }).click();
      await toast(page, `${name} marked as arrived`);
      await expect(page.locator('.qa-item:not([data-resolved])')).toHaveCount(before - 1);
      // Marked well after the shift began, so it counts as a late arrival already dealt with.
      await page.getByRole('button', { name: `Clear filter: Absent employees` }).click();
      await expect(page.getByTestId('qa-status-count-resolved')).toHaveText(String(resolvedBefore + 1));

      await page.locator('.sidebar').getByRole('link', { name: 'Dashboard' }).click();
      await expect(page.getByTestId('qa-count-absent')).toHaveText(String(before - 1));
    });

    test('an overdue check-out opens its booking, and checking out resolves it', async ({ page }) => {
      const before = await count(page, 'qa-count-overdue-checkout');
      await page.getByTestId('qa-card-overdue-checkout').click();
      const row = page.locator('.qa-item:not([data-resolved])').first();
      const guest = (await row.locator('.qa-item-title a').innerText()).trim();
      await row.getByRole('link', { name: /^Open/ }).click();
      await expect(page).toHaveURL(/\/app\/reservations\?open=/);
      const detail = dialog(page, guest);
      await detail.getByRole('button', { name: 'Check out' }).click();
      const checkout = dialog(page, `Check out ${guest}`);
      await checkout.getByRole('button', { name: /and check out|Complete check-out/ }).click();
      await toast(page, /checked out/i);
      await page.goto('/app/dashboard');
      await expect(page.getByTestId('qa-count-overdue-checkout')).toHaveText(String(before - 1));

      await page.goto('/app/quick-actions?category=front-desk&focus=overdue-checkout&status=resolved');
      await expect(page.locator('.qa-item[data-resolved]').filter({ hasText: guest })).toBeVisible();
    });

    test('detail links reach the record in each module', async ({ page }) => {
      await page.goto('/app/quick-actions?category=maintenance');
      await page.locator('.qa-item').filter({ hasText: 'Open' }).first().getByRole('link', { name: /^Open/ }).click();
      await expect(page).toHaveURL(/\/app\/housekeeping\?tab=maintenance&focus=/);
      await expect(page.getByText('Showing the request you opened from Quick Actions.')).toBeVisible();
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await page.getByRole('button', { name: 'Show all' }).click();
      await expect(page).not.toHaveURL(/focus=/);
      expect(await page.locator('tbody tr').count()).toBeGreaterThan(1);

      await page.goto('/app/quick-actions?category=housekeeping');
      await page.locator('.qa-item').first().getByRole('link', { name: /^Open/ }).click();
      await expect(page).toHaveURL(/\/app\/(housekeeping\?focus=|rooms\?open=)/);

      await page.goto('/app/quick-actions?category=staff&focus=absent');
      await page.locator('.qa-item').first().getByRole('link', { name: /^Open/ }).click();
      await expect(page).toHaveURL(/\/app\/staff\?tab=roster&focus=/);
      await expect(page.locator('.shift-card [data-focused]')).toContainText('Not checked in');

      await page.goto('/app/quick-actions?category=finance');
      await page.locator('.qa-item').first().getByRole('link', { name: /^Open/ }).click();
      await expect(page).toHaveURL(/\/app\/billing\?invoice=/);
      await expect(page.getByRole('dialog')).toBeVisible();

    });

    test('with nothing left to do the page says so, and invents nothing', async ({ page }) => {
      await page.evaluate(() => {
        const db = JSON.parse(localStorage.getItem('folio.demo.db')!);
        db.rooms.forEach((r: any) => { r.status = 'vacant'; r.cleaning = 'clean'; });
        db.reservations = [];
        db.invoices = [];
        db.payments = [];
        db.housekeepingTasks = [];
        db.maintenanceRequests = [];
        db.restaurantOrders = [];
        db.guestReviews = [];
        db.duties = [];
        db.attendance = [];
        localStorage.setItem('folio.demo.db', JSON.stringify(db));
      });
      await page.goto('/app/dashboard');
      for (const key of ['rooms-to-clean', 'absent', 'overdue-checkout', 'unchecked-room']) {
        await expect(page.getByTestId(`qa-count-${key}`)).toHaveText('0');
      }
      await expect(page.getByTestId('qa-card-absent')).toContainText('All clear');

      await page.getByRole('link', { name: 'View All' }).click();
      await expect(page.getByRole('heading', { name: 'Everything is taken care of' })).toBeVisible();
      await expect(page.locator('.qa-item')).toHaveCount(0);
      await expect(page.getByText(/Not tracked yet: rooms awaiting inspection, pending refunds, guest complaints/)).toBeVisible();
    });
  });
}

test('a VIP arrival is listed as a special arrival and not again as a pending arrival', async ({ page }) => {
  await atOnePm(page);
  await signIn(page, 'admin');
  const code = await page.evaluate((today) => {
    const db = JSON.parse(localStorage.getItem('folio.demo.db')!);
    const arrivals = db.reservations.filter((r: any) => r.checkIn === today && r.status === 'confirmed' && r.roomId);
    const stay = arrivals[arrivals.length - 1];
    db.guests.find((g: any) => g.id === stay.guestId).vip = true;
    localStorage.setItem('folio.demo.db', JSON.stringify(db));
    return stay.code;
  }, isoDays(0));
  await page.goto('/app/quick-actions?category=front-desk&focus=special-arrival');
  await expect(page.locator('.qa-item').filter({ hasText: code })).toBeVisible();
  await expect(page.locator('.qa-item').filter({ hasText: code }).getByText('VIP')).toBeVisible();
  await page.goto('/app/quick-actions?category=front-desk&focus=pending-arrival');
  await expect(page.locator('.qa-item').first()).toBeVisible();
  await expect(page.locator('.qa-item').filter({ hasText: code })).toHaveCount(0);
});

test('the sample story has a VIP arrival to show', async ({ page }) => {
  await signIn(page, 'admin');
  await page.goto('/app/quick-actions?category=front-desk&focus=special-arrival');
  await expect(page.locator('.qa-item').first()).toBeVisible();
});

test('the check-out deadline is respected: nobody is overdue before 11:00', async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${isoDays(0)}T09:00:00`));
  await signIn(page, 'admin');
  await expect(page.getByTestId('qa-count-overdue-checkout')).toHaveText('0');
  await expect(page.getByTestId('qa-card-overdue-checkout')).toContainText('due out by 11:00');
  // Rooms whose stay ended yesterday are overdue at any hour.
  expect(await count(page, 'qa-count-unchecked-room')).toBeGreaterThan(0);
});

test('a shift that has not started yet is not counted as absent', async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${isoDays(0)}T05:00:00`));
  await signIn(page, 'admin');
  await expect(page.getByTestId('qa-count-absent')).toHaveText('0');
  await expect(page.getByTestId('qa-card-absent')).toContainText('No shift has started');
});

test('cards wrap on smaller screens without overflowing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page, 'admin');
  await expect(page.locator('.qa-card')).toHaveCount(4);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const role of ['reception', 'housekeeping'] as RoleKey[]) {
  test(`${role} has no Quick Actions`, async ({ page }) => {
    await signIn(page, role);
    await expect(page.locator('.sidebar').getByRole('link', { name: 'Quick Actions' })).toHaveCount(0);
    await expect(page.locator('.qa-section')).toHaveCount(0);
    await page.goto('/app/quick-actions');
    await expect(page.getByText('Not part of this role')).toBeVisible();
  });
}
