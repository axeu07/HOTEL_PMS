import { expect, test } from '@playwright/test';
import { dialog, isoDays, readDb, signIn, toast, watchErrors, type RoleKey } from './helpers';

const ALL_ROUTES = ['dashboard', 'customers/stayed', 'customers/leads', 'customers/templates', 'quick-actions', 'front-desk', 'reservations', 'rooms', 'housekeeping', 'guests', 'restaurant', 'billing', 'reports', 'staff', 'settings'];

const NAV_BY_ROLE: Record<RoleKey, string[]> = {
  admin: ALL_ROUTES,
  manager: ALL_ROUTES,
  reception: ['dashboard', 'customers/stayed', 'customers/leads', 'customers/templates', 'front-desk', 'reservations', 'rooms', 'housekeeping', 'guests', 'restaurant', 'billing', 'settings'],
  housekeeping: ['dashboard', 'rooms', 'housekeeping', 'settings'],
};

/** Links in the sidebar. Quick Actions, Reservations, Restaurant, Reports, Staff and Settings are routed but not listed there. */
const SIDEBAR_LINKS: Record<RoleKey, number> = { admin: 10, manager: 10, reception: 9, housekeeping: 3 };

test.describe('entry experience', () => {
  test('landing page shows the hotel, rooms, gallery and sample logins', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Hospitality, Reimagined.');
    await expect(page.locator('.room-row')).toHaveCount(5);
    await expect(page.locator('.amenity')).toHaveCount(6);
    await expect(page.getByText('admin@vasantacourt.example')).toBeVisible();

    await page.getByRole('button', { name: 'View The arrival hall' }).click();
    await expect(page.locator('.lightbox figcaption')).toHaveText('The arrival hall');
    await page.getByRole('button', { name: 'Next image' }).click();
    await expect(page.locator('.lightbox figcaption')).toHaveText('Jasmine courtyard');
    await page.keyboard.press('Escape');
    await expect(page.locator('.lightbox')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  for (const [role, label] of [['admin', 'Administrator'], ['manager', 'Manager'], ['reception', 'Front Desk'],['housekeeping', 'Housekeeping']] as const) {
    test(`one-click entry as ${role} from the landing page`, async ({ page }) => {
      await page.goto('/');
      await page.getByTestId(`role-${role}`).getByRole('button', { name: `Enter as ${label}` }).click();
      await expect(page).toHaveURL(/\/app\/dashboard/);
    });
  }

  test('a website stay request arrives in the software as a pending booking', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Check dates' }).click();
    const form = dialog(page, 'Request your stay');
    await expect(form.getByText(/rooms? left for these dates/)).toBeVisible();
    await form.getByRole('button', { name: 'Send request' }).click();
    await expect(form.getByText('First name is required')).toBeVisible();
    await form.getByLabel('First name').fill('Ivy');
    await form.getByLabel('Last name').fill('Fernsby');
    await form.getByLabel('Email').fill('not-an-email');
    await form.getByLabel('Phone').fill('+91 90000 55555');
    await form.getByRole('button', { name: 'Send request' }).click();
    await expect(form.getByText('Enter a valid email address')).toBeVisible();
    await form.getByLabel('Email').fill('ivy@example.com');
    await form.getByRole('button', { name: 'Send request' }).click();

    await page.getByRole('button', { name: 'See it as the front desk' }).click();
    await expect(page).toHaveURL(/open=/);
    const detail = dialog(page, 'Ivy Fernsby');
    await expect(detail.locator('.badge').first()).toHaveText('Pending');
    await detail.getByRole('button', { name: 'Confirm' }).click();
    await expect(detail.locator('.badge').first()).toHaveText('Confirmed');
  });
});

test.describe('authentication and roles', () => {
  test('protected routes redirect to sign-in, and return after signing in', async ({ page }) => {
    await page.goto('/app/billing');
    await expect(page).toHaveURL(/\/login/);
    await page.getByRole('button', { name: 'Fill in' }).first().click();
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/billing/);
  });

  test('sign-in form rejects wrong details and accepts a sample login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('Email is required')).toBeVisible();
    await page.getByLabel('Email').fill('admin@vasantacourt.example');
    await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByText('do not match a demo account')).toBeVisible();
    await page.getByLabel('Password').fill('demo-admin');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('sign out ends the session', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto('/app/settings');
    await page.getByRole('tab', { name: 'Account & security' }).click();
    await page.getByRole('main').getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/app/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  for (const role of Object.keys(NAV_BY_ROLE) as RoleKey[]) {
    test(`${role}: sidebar has no website, reset or sign-out, and Settings has sign-out`, async ({ page }) => {
      await signIn(page, role);
      const sidebar = page.locator('.sidebar');
      for (const name of ['Hotel website', 'Reset demo data', 'Sign out']) {
        await expect(sidebar.getByText(name)).toHaveCount(0);
      }
      await page.goto('/app/settings?tab=account');
      await expect(page.getByRole('main').getByRole('button', { name: 'Sign out' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Password & security' })).toBeVisible();
    });

    test(`${role}: permitted screens load cleanly, others are blocked`, async ({ page }) => {
      const errors = watchErrors(page);
      await signIn(page, role);
      const nav = page.locator('.sidebar nav a');
      await expect(nav).toHaveCount(SIDEBAR_LINKS[role]);
      for (const route of ALL_ROUTES) {
        await page.goto(`/app/${route}`);
        if (NAV_BY_ROLE[role].includes(route)) {
          await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
          await expect(page.getByText('Not part of this role')).toHaveCount(0);
        } else {
          await expect(page.getByText('Not part of this role')).toBeVisible();
        }
      }
      expect(errors).toEqual([]);
    });
  }

  test('switching demo role changes what the user sees', async ({ page }) => {
    await signIn(page, 'admin');
    await page.getByRole('button', { name: /Account menu/ }).click();
    await page.getByRole('button', { name: 'Switch demo role' }).click();
    await dialog(page, 'Switch demo role').getByRole('button', { name: /^Housekeeping/ }).click();
    await toast(page, 'Now signed in as Housekeeping');
    await expect(page.getByTestId('kpi-my-tasks')).toBeVisible();
    await expect(page.locator('.sidebar nav a')).toHaveCount(3);
  });
});

test.describe('dashboard', () => {
  test('KPIs add up and charts render', async ({ page }) => {
    await signIn(page, 'admin');
    await expect(page.getByTestId('kpi-total-rooms')).toHaveText('48');
    await expect(page.getByTestId('kpi-occupancy')).toHaveText(/\d+%/);
    expect(await page.locator('.recharts-surface').count()).toBeGreaterThanOrEqual(2);
    expect(await page.locator('.room-tile').count()).toBe(48);
    expect(await page.locator('.recharts-area-curve').count()).toBe(1);
    const arrivals = Number(await page.getByTestId('kpi-arrivals').innerText());
    expect(arrivals).toBeGreaterThan(0);
  });
});

test.describe('reservations', () => {
  test('create with validation, then edit and cancel', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'reception');
    await page.goto('/app/reservations');
    await page.getByRole('button', { name: 'New booking' }).click();
    const form = dialog(page, 'New booking');

    await form.getByRole('button', { name: 'Create booking' }).click();
    await expect(form.getByText('Guest is required')).toBeVisible();

    await form.getByRole('button', { name: 'New guest' }).click();
    await form.getByLabel('First name').fill('Noor');
    await form.getByLabel('Last name').fill('Vale');
    await form.getByLabel('Phone').fill('+91 90000 77777');
    await form.getByLabel('Check-in').fill(isoDays(60));
    await form.getByLabel('Check-out').fill(isoDays(58));
    await form.getByRole('button', { name: 'Create booking' }).click();
    await expect(form.getByText('Must be after check-in')).toBeVisible();

    await form.getByLabel('Check-out').fill(isoDays(63));
    await form.getByLabel('Room category').selectOption({ label: 'Lake Studio (sleeps 3)' });
    await form.getByLabel('Room allocation').selectOption({ index: 1 });
    await form.getByLabel('Adults').fill('4');
    await form.getByRole('button', { name: 'Create booking' }).click();
    await expect(form.getByText('Lake Studio sleeps up to 3')).toBeVisible();
    await form.getByLabel('Adults').fill('2');
    await form.getByRole('button', { name: 'Create booking' }).click();
    await toast(page, /Booking VC-\d+ created/);

    const detail = dialog(page, 'Noor Vale');
    await expect(detail.getByRole('definition').filter({ hasText: 'Lake Studio' })).toBeVisible();

    await detail.getByRole('button', { name: 'Edit' }).click();
    const edit = dialog(page, /Edit booking/);
    await edit.getByLabel('Check-out').fill(isoDays(65));
    await edit.getByRole('button', { name: 'Save changes' }).click();
    await toast(page, /updated/);
    await expect(detail.getByText('5', { exact: true })).toBeVisible();

    await detail.getByRole('button', { name: 'Cancel booking' }).click();
    const cancel = dialog(page, /Cancel booking VC/);
    await cancel.getByRole('button', { name: 'Cancel booking' }).click();
    await expect(cancel.getByText('Please record why')).toBeVisible();
    await cancel.getByLabel('Reason').fill('Guest changed plans');
    await cancel.getByRole('button', { name: 'Cancel booking' }).click();
    await expect(detail.locator('.badge').first()).toHaveText('Cancelled');

    // The cancelled booking still shows in the list, with search and filter working.
    await detail.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Noor Vale');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('Status').selectOption('confirmed');
    await expect(page.getByText('No bookings match')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('a room already taken for the dates cannot be allocated', async ({ page }) => {
    await signIn(page, 'admin');
    const taken = await readDb(page, (db) => {
      const rows = db.reservations as unknown as { status: string; roomId: string; categoryId: string; checkOut: string }[];
      // Someone staying past tonight: a guest leaving today would free the room for tonight.
      const stay = rows.find((r) => r.status === 'checked_in' && r.checkOut > isoDays(1))!;
      const number = (db.rooms as unknown as { id: string; number: string }[]).find((r) => r.id === stay.roomId)!.number;
      return { number, categoryId: stay.categoryId };
    });
    await page.goto('/app/reservations');
    await page.getByRole('button', { name: 'New booking' }).click();
    const form = dialog(page, 'New booking');
    await form.getByLabel('Room category').selectOption(taken.categoryId);
    const allocation = form.getByLabel('Room allocation');
    await form.getByLabel('Check-in').fill(isoDays(0));
    await form.getByLabel('Check-out').fill(isoDays(1));
    await expect.poll(() => allocation.locator('option').allTextContents()).not.toContainEqual(expect.stringContaining(`Room ${taken.number} `));
    // With the dates far enough ahead that nothing is booked, the same room is offered.
    await form.getByLabel('Check-in').fill(isoDays(200));
    await form.getByLabel('Check-out').fill(isoDays(202));
    await expect.poll(() => allocation.locator('option').allTextContents()).toContainEqual(expect.stringContaining(`Room ${taken.number} `));
  });

  test('timeline shows stays and starts a booking from an empty day', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/reservations');
    await page.getByRole('button', { name: 'Timeline' }).click();
    await expect(page.getByTestId('timeline')).toBeVisible();
    expect(await page.locator('.tl-bar').count()).toBeGreaterThan(20);
    await page.locator('.tl-bar.tl-checked_in').first().click();
    await expect(page.getByRole('dialog').locator('.badge').first()).toHaveText('In house');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Far enough ahead that the calendar is empty: selecting a day starts a booking.
    for (let i = 0; i < 9; i++) await page.getByRole('button', { name: 'Later' }).click();
    await expect(page.locator('.tl-bar')).toHaveCount(0);
    await page.locator('.tl-cell').first().click();
    const form = dialog(page, 'New booking');
    await expect(form.getByLabel('Room allocation')).not.toHaveValue('');
  });
});

test.describe('front desk', () => {
  test('check-in moves a guest into a room', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'reception');
    await page.goto('/app/front-desk');
    const tab = page.getByRole('tab', { name: /Today's arrivals/ });
    const before = Number(await tab.locator('.count').innerText());
    expect(before).toBeGreaterThan(0);

    const ready = page.locator('tbody tr').filter({ hasText: 'Clean' }).first();
    await ready.getByRole('button', { name: 'Check in' }).click();
    const modal = dialog(page, /Check in /);
    await modal.getByRole('button', { name: 'Complete check-in' }).click();
    await toast(page, /checked in to room/);
    await expect(tab.locator('.count')).toHaveText(String(before - 1));
    expect(errors).toEqual([]);
  });

  test('check-out settles the bill and queues the room for housekeeping', async ({ page }) => {
    await signIn(page, 'reception');
    await page.goto('/app/front-desk?tab=departures');
    const tab = page.getByRole('tab', { name: /Today's departures/ });
    const before = Number(await tab.locator('.count').innerText());
    expect(before).toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Check out' }).first().click();
    const modal = dialog(page, /Check out /);
    await modal.getByRole('button', { name: /check out|Complete check-out/i }).click();
    await toast(page, /checked out\. Room queued/);
    await expect(tab.locator('.count')).toHaveText(String(before - 1));

    await page.goto('/app/housekeeping');
    await expect(page.getByText('Created automatically at check-out.')).toBeVisible();
  });

  test('a room that is not ready blocks check-in until another is chosen', async ({ page }) => {
    await signIn(page, 'reception');
    await page.goto('/app/front-desk');
    const row = page.locator('tbody tr').filter({ hasText: /Needs cleaning|Being cleaned|Guest leaving/ }).first();
    await row.getByRole('button', { name: 'Check in' }).click();
    const modal = dialog(page, /Check in /);
    await expect(modal.getByText(/is not ready/)).toBeVisible();
    await expect(modal.getByRole('button', { name: 'Complete check-in' })).toBeDisabled();
  });

  test('leaving early bills only the nights stayed', async ({ page }) => {
    await signIn(page, 'reception');
    const stay = await readDb(page, (db) => {
      const rows = db.reservations as unknown as { status: string; checkIn: string; checkOut: string; code: string; ratePerNight: number }[];
      return rows.find((r) => r.status === 'checked_in' && r.checkOut > isoDays(1) && r.checkIn < isoDays(0))!;
    });
    await page.goto('/app/front-desk?tab=inhouse');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill(stay.code);
    await page.getByRole('button', { name: 'Check out' }).click();
    const modal = dialog(page, /Check out /);
    await expect(modal.getByText(/leaving after \d+/)).toBeVisible();
    await modal.getByRole('button', { name: /check out|Complete check-out/i }).click();
    await toast(page, /checked out/);
    const saved = await readDb(page, (db) => (db.reservations as unknown as { code: string; checkOut: string; status: string }[]).find((r) => r.code === stay.code)!);
    expect(saved.status).toBe('checked_out');
    expect(saved.checkOut).toBe(isoDays(0));
  });

  test('walk-in creates a guest and checks them in', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'reception');
    await page.goto('/app/front-desk?tab=inhouse');
    const tab = page.getByRole('tab', { name: /In house/ });
    const before = Number(await tab.locator('.count').innerText());

    await page.getByRole('button', { name: 'Walk-in booking' }).click();
    const form = dialog(page, 'Walk-in booking');
    await form.getByRole('button', { name: 'Create and check in' }).click();
    await expect(form.getByText('Choose a room for the walk-in')).toBeVisible();
    await form.getByLabel('First name').fill('Omar');
    await form.getByLabel('Last name').fill('Quill');
    await form.getByLabel('Phone').fill('+91 90000 88888');
    await form.getByLabel('Room allocation').selectOption({ index: 1 });
    await form.getByRole('button', { name: 'Create and check in' }).click();
    await toast(page, /Walk-in checked in/);
    await expect(tab.locator('.count')).toHaveText(String(before + 1));
    await expect(page.getByText('Omar Quill')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('rooms', () => {
  test('filter, add, edit, take out of service and delete a room', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/rooms');
    await page.getByLabel('Status', { exact: true }).selectOption('maintenance');
    await expect(page.locator('.room-tile')).toHaveCount(2);
    await page.getByLabel('Status', { exact: true }).selectOption('');

    await page.getByRole('button', { name: 'Add room' }).click();
    const form = dialog(page, 'Add a room');
    await form.getByLabel('Room number').fill('101');
    await form.getByRole('button', { name: 'Add room' }).click();
    await expect(form.getByText('Room 101 already exists')).toBeVisible();
    await form.getByLabel('Room number').fill('999');
    await form.getByLabel('Floor').fill('9');
    await form.getByRole('button', { name: 'Add room' }).click();
    await toast(page, 'Room 999 added');

    await page.getByRole('button', { name: /^Room 999/ }).click();
    const detail = dialog(page, 'Room 999');
    await detail.getByRole('button', { name: 'Take out of service' }).click();
    await expect(detail.locator('.badge').first()).toHaveText('Maintenance');
    await detail.getByRole('button', { name: 'Return to service' }).click();
    await expect(detail.locator('.badge').first()).toHaveText('Vacant');
    await detail.getByRole('button', { name: 'Delete' }).click();
    await dialog(page, 'Delete room 999?').getByRole('button', { name: 'Delete room' }).click();
    await toast(page, 'Room 999 deleted');
  });

  test('category pricing can be edited', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/rooms');
    await page.getByRole('tab', { name: /Categories/ }).click();
    await page.getByRole('button', { name: 'Edit' }).first().click();
    const form = dialog(page, /Edit Mountain View Suite/);
    await form.getByLabel(/Price per night/).fill('7000');
    await form.getByRole('button', { name: 'Save category' }).click();
    await expect(page.getByText('₹7,000').first()).toBeVisible();
  });
});

test.describe('guests', () => {
  test('add, search, view profile, and refuse deleting history', async ({ page }) => {
    await signIn(page, 'reception');
    await page.goto('/app/guests');
    await page.getByRole('button', { name: 'Add guest' }).click();
    const form = dialog(page, 'Add a guest');
    await form.getByRole('button', { name: 'Add guest' }).click();
    await expect(form.getByText('First name is required')).toBeVisible();
    await form.getByLabel('First name').fill('Wren');
    await form.getByLabel('Last name').fill('Ashby');
    await form.getByLabel('Phone').fill('+91 90000 44444');
    await form.getByLabel('Dietary').selectOption('vegan');
    await form.getByRole('button', { name: 'Add guest' }).click();
    await toast(page, 'Wren Ashby added');

    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Wren');
    await page.locator('tbody tr').first().click();
    const profile = dialog(page, 'Wren Ashby');
    await expect(profile.getByText('Vegan')).toBeVisible();
    await expect(profile.getByText('No bookings yet.')).toBeVisible();
    await profile.getByRole('button', { name: 'Delete' }).click();
    await dialog(page, 'Delete Wren Ashby?').getByRole('button', { name: 'Delete guest' }).click();
    await toast(page, 'Guest deleted');
  });
});

test.describe('housekeeping', () => {
  test('attendant starts and finishes a task, making the room clean', async ({ page }) => {
    await signIn(page, 'housekeeping');
    await page.goto('/app/housekeeping');
    await page.getByRole('button', { name: 'My tasks' }).click();
    const row = page.locator('tbody tr').filter({ has: page.getByRole('button', { name: 'Start' }) }).first();
    const roomText = (await row.locator('td').first().innerText()).trim();
    await row.getByRole('button', { name: 'Start' }).click();
    await toast(page, /started/);
    await page.locator('tbody tr').filter({ hasText: roomText }).getByRole('button', { name: 'Done' }).click();
    await toast(page, /is clean/);
    await expect(page.locator('tbody tr').filter({ hasText: roomText }).getByRole('button', { name: 'Reopen' })).toBeVisible();
  });

  test('assign a task and report maintenance that takes a room offline, then resolve it', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto('/app/housekeeping');
    const unassigned = page.getByLabel(/^Assign room/).first();
    await unassigned.selectOption({ label: 'Sunita Rana' });
    await toast(page, 'Assigned to Sunita Rana');

    await page.getByRole('tab', { name: /Maintenance/ }).click();
    await page.getByRole('button', { name: 'Report a problem' }).click();
    const form = dialog(page, 'Report a maintenance problem');
    const roomSelect = form.getByLabel('Room', { exact: true });
    const options = await roomSelect.locator('option').allTextContents();
    await roomSelect.selectOption({ label: options.find((o) => o.includes('Vacant'))! });
    await form.getByLabel("What's wrong?").fill('Cracked basin');
    await form.getByLabel(/Take this room out of service/).check();
    await form.getByRole('button', { name: 'Log request' }).click();
    await toast(page, 'Maintenance request logged');
    const row = page.locator('tbody tr').filter({ hasText: 'Cracked basin' });
    await expect(row).toContainText('room out of service');
    await row.getByRole('button', { name: 'Resolve' }).click();
    await toast(page, 'Marked as resolved');
    await expect(page.locator('tbody tr').filter({ hasText: 'Cracked basin' })).toContainText('Resolved');
  });
});

test.describe('restaurant and billing', () => {
  test('room service order flows through the kitchen and onto the guest bill', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'reception');
    await page.goto('/app/restaurant');
    await page.getByRole('button', { name: 'New order' }).click();
    const form = dialog(page, 'New food order');
    await form.getByRole('button', { name: 'Send to kitchen' }).click();
    await expect(form.getByText('In-house guest is required')).toBeVisible();
    await expect(form.getByText('Add at least one item')).toBeVisible();
    await form.getByLabel('In-house guest').selectOption({ index: 1 });
    await form.getByRole('button', { name: 'Add one Dal Vasanta' }).click();
    await form.getByRole('button', { name: 'Add one Dal Vasanta' }).click();
    await form.getByRole('button', { name: 'Add one Masala Chai Pot' }).click();
    await expect(form.getByText('Total ₹1,300')).toBeVisible();
    await form.getByRole('button', { name: 'Send to kitchen' }).click();
    await toast(page, /sent to the kitchen/);

    const ticket = page.locator('.ticket').filter({ hasText: 'Dal Vasanta' }).filter({ hasText: 'Masala Chai Pot' }).first();
    await ticket.getByRole('button', { name: 'Start preparing' }).click();
    await ticket.getByRole('button', { name: 'Mark ready' }).click();
    await ticket.getByRole('button', { name: 'Mark delivered' }).click();
    await ticket.getByRole('button', { name: 'Add to bill' }).click();
    await toast(page, /added to the guest bill/);
    await expect(ticket.getByText('On guest bill')).toBeVisible();

    // Follows the charge through to the invoice via the notification.
    await page.getByRole('button', { name: /Notifications/ }).click();
    await page.locator('.popover').getByRole('button', { name: /charged to invoice/ }).first().click();
    const doc = page.getByTestId('invoice-doc');
    await expect(doc.getByText(/Room service · KOT/)).toBeVisible();
    await expect(doc.getByRole('row').filter({ hasText: /Room service · KOT/ })).toContainText('₹1,300');
    expect(errors).toEqual([]);
  });

  test('invoice computes tax, takes charges and payments, and prints', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/billing');
    await page.getByLabel('Payment status').selectOption('unpaid');
    await page.locator('tbody tr').first().click();
    const doc = page.getByTestId('invoice-doc');
    await expect(doc).toBeVisible();

    const parse = (s: string) => Number(s.replace(/[^\d.]/g, ''));
    const firstTotal = parse(await page.getByTestId('invoice-total').innerText());

    await page.getByRole('button', { name: 'Add charge' }).click();
    const charge = dialog(page, 'Add a charge');
    await charge.getByLabel('Description').fill('Airport transfer');
    await charge.getByLabel('Unit price').fill('1000');
    await charge.getByRole('button', { name: 'Add charge' }).click();
    await toast(page, 'Charge added to the bill');
    await expect(doc.getByText('Airport transfer')).toBeVisible();
    // Service tax is 18%, so the 1,000 charge adds 1,180.
    await expect.poll(async () => parse(await page.getByTestId('invoice-total').innerText())).toBe(firstTotal + 1180);

    await page.getByRole('button', { name: 'Record payment' }).click();
    const pay = dialog(page, 'Record a payment');
    await pay.getByLabel('Amount').fill(String(firstTotal + 5000));
    await pay.getByRole('button', { name: 'Record payment' }).click();
    await expect(pay.getByText('more than the balance')).toBeVisible();
    await pay.getByLabel('Amount').fill(String(firstTotal + 1180));
    await pay.getByRole('button', { name: 'Record payment' }).click();
    await toast(page, /Payment of .* recorded/);
    await expect(page.getByTestId('invoice-balance')).toHaveText('₹0');
    await expect(page.getByRole('dialog').locator('.badge').first()).toHaveText('Paid');

    await page.evaluate(() => { (window as unknown as { printed: boolean }).printed = false; window.print = () => { (window as unknown as { printed: boolean }).printed = true; }; });
    await page.getByRole('button', { name: 'Print invoice' }).click();
    expect(await page.evaluate(() => (window as unknown as { printed: boolean }).printed)).toBe(true);

    await page.emulateMedia({ media: 'print' });
    await expect(doc).toBeVisible();
    await expect(page.locator('.sidebar')).toBeHidden();
    // One invoice, one page: the app behind the dialog must not spill onto extra sheets.
    const pdf = (await page.pdf({ format: 'A4' })).toString('latin1');
    expect(pdf.match(/\/Type\s*\/Page[^s]/g)?.length).toBe(1);
    await page.emulateMedia({ media: 'screen' });
  });
});

test.describe('staff, reports and settings', () => {
  test('staff directory and roster CRUD', async ({ page }) => {
    await signIn(page, 'manager');
    await page.goto('/app/staff');
    await page.getByRole('button', { name: 'Add team member' }).click();
    const form = dialog(page, 'Add a team member');
    await form.getByLabel('Full name').fill('Asha Verma');
    await form.getByLabel('Job title').fill('Concierge');
    await form.getByLabel('Phone').fill('+91 90000 33333');
    await form.getByRole('button', { name: 'Add to team' }).click();
    await toast(page, 'Asha Verma added to the team');

    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Asha');
    await page.getByRole('button', { name: 'Edit Asha Verma' }).click();
    await dialog(page, 'Edit Asha Verma').getByLabel('Job title').fill('Head Concierge');
    await dialog(page, 'Edit Asha Verma').getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Head Concierge')).toBeVisible();

    await page.getByRole('tab', { name: /Duty roster/ }).click();
    await page.getByRole('button', { name: 'Assign duty' }).click();
    const duty = dialog(page, 'Assign a duty');
    await duty.getByLabel('Team member').selectOption({ label: 'Asha Verma · Front Office' });
    await duty.getByLabel('Area').fill('Concierge desk');
    await duty.getByRole('button', { name: 'Save duty' }).click();
    await toast(page, 'Duty saved');
    await expect(page.getByText('Concierge desk')).toBeVisible();
    await page.getByRole('button', { name: 'Remove duty for Asha Verma' }).click();
    await toast(page, 'Duty removed');

    await page.getByRole('tab', { name: /Directory/ }).click();
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Asha');
    await page.getByRole('button', { name: 'Remove Asha Verma' }).click();
    await dialog(page, 'Remove Asha Verma?').getByRole('button', { name: 'Remove' }).click();
    await toast(page, 'Asha Verma removed');
  });

  test('every report renders and exports', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'manager');
    await page.goto('/app/reports');
    await expect(page.locator('.recharts-bar-rectangle').first()).toBeVisible();
    for (const name of ['Occupancy', 'Bookings', 'Check-in / check-out', 'Revenue']) {
      await page.getByRole('tab', { name }).click();
      await expect(page.locator('.ledger-value').first()).toBeVisible();
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
    }
    await page.getByRole('button', { name: '90 days' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Custom', exact: true }).click();
    await expect(page.getByLabel('From')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('tax settings change what new charges cost', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/settings');
    await page.getByRole('tab', { name: 'Tax' }).click();
    await page.getByLabel('Other services tax (%)').fill('10');
    await page.getByRole('button', { name: 'Save tax settings' }).click();
    await toast(page, 'Tax settings saved');

    await page.goto('/app/billing');
    await page.getByLabel('Payment status').selectOption('unpaid');
    await page.locator('tbody tr').first().click();
    await page.getByRole('button', { name: 'Add charge' }).click();
    await expect(dialog(page, 'Add a charge').getByText('Plus GST at 10%')).toBeVisible();
  });

  test('hotel profile and currency change across the product', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/settings');
    await page.getByLabel('Hotel name').fill('Checkmate Stays Palace');
    await page.getByLabel('Currency').selectOption('USD');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await toast(page, 'Hotel profile saved');
    await expect(page.locator('.brand-logo')).toHaveAttribute('alt', 'Checkmate Stays Palace');
    await page.goto('/app/billing');
    await expect(page.locator('tbody tr').first()).toContainText('$');
  });

  test('preferences change theme and density, reader roles cannot edit the hotel', async ({ page }) => {
    await signIn(page, 'housekeeping');
    await page.goto('/app/settings');
    await expect(page.getByLabel('Hotel name')).toHaveCount(0);
    await page.getByLabel('Theme', { exact: true }).selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByLabel('Table density').selectOption('compact');
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  });
});

test.describe('sample data integrity', () => {
  test('the seeded story is internally consistent', async ({ page }) => {
    await signIn(page, 'admin');
    const db = await page.evaluate(() => JSON.parse(localStorage.getItem('folio.demo.db')!));
    const now = isoDays(0);
    type R = { id: string; roomId: string | null; status: string; checkIn: string; checkOut: string; guestId: string; categoryId: string; adults: number; children: number };
    const stays: R[] = db.reservations;

    // No room holds two live stays for overlapping nights.
    const live = stays.filter((r) => r.roomId && ['pending', 'confirmed', 'checked_in'].includes(r.status));
    for (const a of live) {
      for (const b of live) {
        if (a.id !== b.id && a.roomId === b.roomId) expect(a.checkIn < b.checkOut && b.checkIn < a.checkOut, `${a.id} clashes with ${b.id}`).toBe(false);
      }
    }

    // Room state agrees with who is in house.
    const inHouse = stays.filter((r) => r.status === 'checked_in');
    const occupied = db.rooms.filter((r: { status: string }) => r.status === 'occupied');
    expect(occupied.length).toBe(inHouse.length);
    expect(new Set(inHouse.map((r) => r.roomId)).size).toBe(inHouse.length);
    expect(db.rooms.length).toBe(48);

    // There is something to demonstrate at the desk, and no guest is in two rooms.
    expect(stays.filter((r) => r.checkIn === now && r.status === 'confirmed').length).toBeGreaterThanOrEqual(3);
    expect(stays.filter((r) => r.checkOut === now && r.status === 'checked_in').length).toBeGreaterThanOrEqual(3);
    expect(new Set(inHouse.map((r) => r.guestId)).size).toBe(inHouse.length);
    const readyArrivals = stays.filter((r) => {
      const room = db.rooms.find((x: { id: string }) => x.id === r.roomId);
      return r.checkIn === now && r.status === 'confirmed' && room?.status === 'vacant' && room?.cleaning === 'clean';
    });
    expect(readyArrivals.length, 'arrivals ready to check in').toBeGreaterThanOrEqual(3);

    // Nobody is booked into two rooms for overlapping dates.
    const live2 = stays.filter((r) => !['cancelled', 'no_show'].includes(r.status));
    const byGuest = new Map<string, R[]>();
    live2.forEach((r) => byGuest.set(r.guestId, [...(byGuest.get(r.guestId) ?? []), r]));
    for (const [guestId, list] of byGuest) {
      const sorted = [...list].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
      for (let i = 1; i < sorted.length; i++) expect(sorted[i - 1].checkOut <= sorted[i].checkIn, guestId).toBe(true);
    }

    // Every stay fits its room category, so editing any of them works.
    const capacity = new Map(db.roomCategories.map((c: { id: string; capacity: number }) => [c.id, c.capacity]));
    for (const r of stays) expect(r.adults + r.children, r.id).toBeLessThanOrEqual(capacity.get(r.categoryId) as number);

    // A housekeeper has work to show.
    const walkInReady = db.rooms.filter((r: { id: string; status: string; cleaning: string }) =>
      r.status === 'vacant' && r.cleaning === 'clean' && !live.some((s) => s.roomId === r.id && s.checkIn < isoDays(2) && s.checkOut > now));
    expect(walkInReady.length, 'rooms free for a walk-in').toBeGreaterThanOrEqual(3);

    const lata = db.housekeepingTasks.filter((t: { assigneeId: string; date: string }) => t.assigneeId === 'staff-7' && t.date === now);
    expect(lata.length).toBeGreaterThan(0);
  });
});

test.describe('demo lifecycle', () => {
  test('changes persist across reloads, and reset restores the sample story', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/guests');
    await page.getByRole('button', { name: 'Add guest' }).click();
    const form = dialog(page, 'Add a guest');
    await form.getByLabel('First name').fill('Persist');
    await form.getByLabel('Last name').fill('Tester');
    await form.getByLabel('Phone').fill('+91 90000 11111');
    await form.getByRole('button', { name: 'Add guest' }).click();
    await toast(page, 'Persist Tester added');

    await page.reload();
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Persist');
    await expect(page.getByText('Persist Tester')).toBeVisible();

    await page.goto('/app/settings?tab=preferences');
    await page.getByRole('main').getByRole('button', { name: 'Reset demo data' }).click();
    await dialog(page, 'Reset demo data?').getByRole('button', { name: 'Reset demo' }).click();
    await toast(page, 'Demo data reset');
    await page.goto('/app/guests');
    await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('Persist');
    await expect(page.getByText('No guests match')).toBeVisible();
  });

  test('global search finds guests, bookings and rooms', async ({ page }) => {
    await signIn(page, 'admin');
    await page.keyboard.press('Control+k');
    const box = page.getByRole('searchbox', { name: 'Search guests, leads, bookings and rooms' });
    await expect(box).toBeFocused();
    await box.fill('501');
    await page.locator('.search-results').getByRole('button', { name: /Room 501/ }).click();
    await expect(dialog(page, 'Room 501')).toBeVisible();
  });

  test('notifications open and mark as read', async ({ page }) => {
    await signIn(page, 'admin');
    await page.getByRole('button', { name: /Notifications, 3 unread/ }).click();
    await page.getByRole('button', { name: 'Mark all read' }).click();
    await expect(page.getByRole('button', { name: /Notifications, 0 unread/ })).toBeVisible();
  });
});

test.describe('sidebar', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('hovering a link tilts it, and leaving resets it', async ({ page }) => {
    await signIn(page, 'admin');
    const link = page.locator('.sidebar').getByRole('link', { name: 'Billing' });
    const box = (await link.boundingBox())!;
    await page.mouse.move(box.x + box.width - 4, box.y + 4);
    await expect.poll(() => link.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--tilt-y'))).not.toBe('');
    await page.mouse.move(800, 400);
    await expect.poll(() => link.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--tilt-y'))).toBe('');
  });

  test('the active highlight follows navigation and the rail collapses and remembers', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'admin');
    const indicator = page.locator('.nav-indicator');
    const top = () => indicator.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m42);
    const activeTop = () => page.locator('.nav-link.active').evaluate((el) => (el as HTMLElement).offsetTop);
    await page.locator('.sidebar').getByRole('link', { name: 'Billing' }).click();
    await expect(page).toHaveURL(/billing/);
    await expect.poll(async () => Math.round(await top())).toBe(await activeTop());

    await page.getByRole('button', { name: 'Collapse sidebar' }).click();
    await expect.poll(() => page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width)).toBeLessThan(100);
    await expect(page.locator('.sidebar nav a')).toHaveCount(SIDEBAR_LINKS.admin);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
    await page.getByRole('button', { name: 'Expand sidebar' }).click();
    await expect.poll(() => page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(200);
    expect(errors).toEqual([]);
  });

  test('closing a dialog leaves nothing behind', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/guests');
    await page.getByRole('button', { name: 'Add guest' }).click();
    await dialog(page, 'Add a guest').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.modal-root')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add guest' })).toBeEnabled();
    await page.getByRole('button', { name: 'Add guest' }).click();
    await expect(dialog(page, 'Add a guest')).toBeVisible();
  });
});

test.describe('responsive layouts', () => {
  for (const width of [390, 820]) {
    test(`no horizontal page overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/');
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(await overflow()).toBeLessThanOrEqual(0);
      await page.goto('/login');
      await page.getByRole('button', { name: 'One-click sign in as Hotel Administrator' }).click();
      await expect(page).toHaveURL(/dashboard/);
      for (const route of ALL_ROUTES) {
        await page.goto(`/app/${route}`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(await overflow(), route).toBeLessThanOrEqual(0);
      }
    });
  }

  test('mobile menu opens and navigates', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, 'admin');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.locator('.sidebar').getByRole('link', { name: 'Front Desk' }).click();
    await expect(page).toHaveURL(/front-desk/);
    await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
  });
});
