import { expect, test, type Page } from '@playwright/test';
import jsQR from 'jsqr';
import { dialog, readDb, signIn, toast, watchErrors } from './helpers';

const DB = 'folio.demo.db';
const REGISTER_TOKEN = 'vc3p8w5nz6rt';

// A 2x2 PNG is enough for the upload: the page redraws whatever it is given as a JPEG.
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYGJAQoAHhgCAh6X4CYAAAAASUVORK5CYII=', 'base64');

async function openWalkIn(page: Page) {
  await page.goto('/app/front-desk');
  await page.getByRole('button', { name: 'Walk-in booking' }).click();
  return dialog(page, 'Walk-in booking');
}

test.describe('Smart guest lookup in the walk-in form', () => {
  test('1234567890 finds the returning guest and fills what is saved', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'reception');
    const form = await openWalkIn(page);
    await expect(form.getByText('Enter the phone number to find a returning guest.')).toBeVisible();

    await form.getByTestId('walkin-phone').fill('1234567890');
    const card = form.getByTestId('lookup-returning');
    await expect(card).toBeVisible();
    await expect(card).toContainText('Returning guest found');
    await expect(card).toContainText(/[2-9] visits/);
    await expect(card).toContainText('Last stay');
    await expect(card).toContainText('Vegetarian');

    await expect(form.getByLabel('First name')).toHaveValue('Vikram');
    await expect(form.getByLabel('Last name')).toHaveValue('Rao');
    await expect(form.getByLabel('Age (optional)')).toHaveValue('41');
    await expect(form.getByLabel('ID document (optional)')).toHaveValue('passport');
    await expect(form.getByLabel('ID number')).toHaveValue('Z7XXXX41');
    await expect(form.getByLabel('Company')).toHaveValue('Halden Consulting');

    // Outdated details can be corrected, and the correction is saved to the same record.
    await form.getByLabel('Company').fill('Rao Advisory');
    await form.getByLabel('Room allocation').selectOption({ index: 1 });
    const guestsBefore = await readDb(page, (db) => db.guests.length);
    await form.getByRole('button', { name: 'Create and check in' }).click();
    await toast(page, /Walk-in checked in/);

    const after = await readDb(page, (db) => ({ guests: db.guests as unknown as { phone: string; company: string }[] }));
    expect(after.guests.length).toBe(guestsBefore); // No duplicate guest.
    expect(after.guests.find((g) => g.phone === '1234567890')?.company).toBe('Rao Advisory');
    expect(errors).toEqual([]);
  });

  test('also matches the number typed with a country code and spaces', async ({ page }) => {
    await signIn(page, 'reception');
    const form = await openWalkIn(page);
    await form.getByTestId('walkin-phone').fill('+91 12345 67890');
    await expect(form.getByTestId('lookup-returning')).toBeVisible();
    await expect(form.getByLabel('First name')).toHaveValue('Vikram');
  });

  test('changing the number to an unknown one clears the previous guest instead of leaving their details behind', async ({ page }) => {
    await signIn(page, 'reception');
    const form = await openWalkIn(page);
    const phone = form.getByTestId('walkin-phone');
    await phone.fill('1234567890');
    await expect(form.getByLabel('First name')).toHaveValue('Vikram');
    await phone.fill('9998887776');
    await expect(form.getByTestId('lookup-new')).toBeVisible();
    await expect(form.getByLabel('First name')).toHaveValue('');
    await expect(form.getByLabel('ID number')).toHaveValue('');
    await expect(form.getByLabel('Company')).toHaveCount(0);
  });

  test('an unknown number shows the new-guest fields and registers a new guest with age and ID', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'reception');
    const form = await openWalkIn(page);
    await form.getByTestId('walkin-phone').fill('9876500011');
    await expect(form.getByTestId('lookup-new')).toContainText('No saved record');
    await form.getByLabel('First name').fill('Leela');
    await form.getByLabel('Last name').fill('Pinto');
    await form.getByLabel('Age (optional)').fill('33');
    await form.getByLabel('ID document (optional)').selectOption('driving_licence');
    await form.getByLabel('ID number').fill('GA0120XXXX88');
    await form.getByLabel('Room allocation').selectOption({ index: 1 });
    await form.getByRole('button', { name: 'Create and check in' }).click();
    await toast(page, /Walk-in checked in/);

    const guest = await readDb(page, (db) => (db.guests as unknown as { phone: string; age?: number; idType: string; idNumber: string }[]).find((g) => g.phone === '9876500011'));
    expect(guest).toMatchObject({ age: 33, idType: 'driving_licence', idNumber: 'GA0120XXXX88' });

    // Next time, the same number is recognised.
    await page.goto('/app/front-desk');
    await page.getByRole('button', { name: 'Walk-in booking' }).click();
    const again = dialog(page, 'Walk-in booking');
    await again.getByTestId('walkin-phone').fill('9876500011');
    await expect(again.getByLabel('First name')).toHaveValue('Leela');
    expect(errors).toEqual([]);
  });

  test('an invalid age is refused', async ({ page }) => {
    await signIn(page, 'reception');
    const form = await openWalkIn(page);
    await form.getByTestId('walkin-phone').fill('9876500022');
    await form.getByLabel('First name').fill('Test');
    await form.getByLabel('Last name').fill('Guest');
    await form.getByLabel('Age (optional)').fill('250');
    await form.getByRole('button', { name: 'Create and check in' }).click();
    await expect(form.getByText('Enter an age between 1 and 120')).toBeVisible();
  });
});

test.describe('Sharing bills by WhatsApp and email', () => {
  test('both icons open prefilled links for the guest, and say nothing was sent', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'admin');
    await page.goto('/app/billing');
    await page.getByPlaceholder('Guest, invoice or booking number').fill('Vikram Rao');
    const row = page.locator('tbody tr').first();
    await expect(row).toContainText('Vikram Rao');

    const wa = row.getByTestId('share-whatsapp');
    const mail = row.getByTestId('share-email');
    const waHref = (await wa.getAttribute('href'))!;
    expect(waHref).toMatch(/^https:\/\/wa\.me\/911234567890\?text=/);
    const text = decodeURIComponent(waHref.split('?text=')[1]);
    expect(text).toContain('Hello Vikram');
    expect(text).toMatch(/Invoice: VC\//);
    expect(text).toContain('Total:');
    expect(await wa.getAttribute('target')).toBe('_blank');

    const mailHref = (await mail.getAttribute('href'))!;
    expect(mailHref).toMatch(/^mailto:vikram\.rao@example\.com\?subject=/);
    expect(decodeURIComponent(mailHref)).toContain('Your bill from HOTEL PMS');

    // The same two buttons are on the invoice itself. Stop the navigation: only the link matters here.
    await page.evaluate(() => document.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('a[href^="mailto"], a[href*="wa.me"]')) e.preventDefault(); }, true));
    await row.locator('td').first().click();
    const invoice = dialog(page, /Invoice VC\//);
    await expect(invoice.getByTestId('share-whatsapp')).toHaveAttribute('href', /wa\.me\/911234567890/);
    await invoice.getByTestId('share-email').click();
    await toast(page, /Review it and press Send there/);
    // Honest wording: it never claims the bill went out.
    await expect(page.locator('.toast').filter({ hasText: /sent to|was sent|has been sent/i })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('missing contact details are explained instead of opening anything', async ({ page }) => {
    await signIn(page, 'admin');
    await page.evaluate((key) => {
      const db = JSON.parse(localStorage.getItem(key)!);
      const guest = db.guests.find((g: { phone: string }) => g.phone === '1234567890');
      guest.email = '';
      guest.phone = '';
      localStorage.setItem(key, JSON.stringify(db));
    }, DB);
    await page.goto('/app/billing');
    await page.getByPlaceholder('Guest, invoice or booking number').fill('Vikram Rao');
    const row = page.locator('tbody tr').first();
    await expect(row.getByTestId('share-whatsapp')).toHaveAttribute('data-missing', '');
    await expect(row.getByTestId('share-whatsapp')).not.toHaveAttribute('href', /.*/);
    await row.getByTestId('share-whatsapp').click();
    await toast(page, /no phone number saved/);
    await row.getByTestId('share-email').click();
    await toast(page, /no email address saved/);
  });
});

test.describe('Guest ID QR and self check-in', () => {
  test('front desk generates the QR, which decodes to this hotel\'s registration page', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'reception');
    await page.goto('/app/front-desk');
    await page.getByRole('tab', { name: 'Guest ID QR' }).click();
    await expect(page.getByTestId('register-qr-poster')).toBeVisible();
    await expect(page.getByText('Place it at reception')).toBeVisible();

    const url = (await page.getByTestId('register-url').innerText()).trim();
    expect(url).toBe(`${new URL(page.url()).origin}/register/${REGISTER_TOKEN}`);

    const px = await page.getByTestId('register-qr').evaluate(async (img: HTMLImageElement) => {
      const size = 600;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      const copy = new Image();
      copy.src = img.src;
      await copy.decode();
      ctx.drawImage(copy, 0, 0, size, size);
      return { data: Array.from(ctx.getImageData(0, 0, size, size).data), size };
    });
    expect(jsQR(new Uint8ClampedArray(px.data), px.size, px.size)?.data).toBe(url);

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    expect((await download).suggestedFilename()).toMatch(/guest-registration-qr\.png$/);
    await expect(page.getByRole('button', { name: 'Print' })).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('a guest registers on their phone without signing in, and staff verify and check them in', async ({ page, browser }) => {
    const errors = watchErrors(page);
    await signIn(page, 'reception');

    // The guest's phone: a separate context that shares the demo store through the same origin.
    const phone = await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, baseURL: new URL(page.url()).origin });
    const guest = await phone.newPage();
    const guestErrors = watchErrors(guest);
    // Share the demo database, as one browser would: copy the staff browser's store into the guest context.
    const store = await page.evaluate(() => ({ db: localStorage.getItem('folio.demo.db'), meta: localStorage.getItem('folio.demo.meta') }));
    await guest.addInitScript(([db, meta]) => { if (!localStorage.getItem('folio.demo.db')) { localStorage.setItem('folio.demo.db', db!); localStorage.setItem('folio.demo.meta', meta!); } }, [store.db, store.meta]);

    await guest.goto(`/register/${REGISTER_TOKEN}`);
    await expect(guest.getByRole('heading', { name: 'Register for your stay' })).toBeVisible();
    await expect(guest.getByText('HOTEL PMS').first()).toBeVisible();
    // No staff navigation on the public page, and the page does not require sign-in.
    await expect(guest.locator('.sidebar, nav[aria-label="Main"]')).toHaveCount(0);
    expect(guest.url()).toContain('/register/');

    // Validation.
    await guest.getByRole('button', { name: 'Submit registration' }).click();
    await expect(guest.getByText('Enter your phone number')).toBeVisible();
    await expect(guest.getByText('Enter your name')).toBeVisible();
    await expect(guest.getByText('Enter your age')).toBeVisible();
    await expect(guest.getByText('Upload a photo of your ID')).toBeVisible();
    await guest.getByLabel('Phone number').fill('12345');
    await guest.getByLabel('Age').fill('16');
    await guest.getByLabel('Full name').fill('Zed<script>');
    await guest.getByRole('button', { name: 'Submit registration' }).click();
    await expect(guest.getByText('Enter a valid phone number, 10 to 15 digits')).toBeVisible();
    await expect(guest.getByText(/must be 18 or older/)).toBeVisible();
    await expect(guest.getByText('Use letters only in your name')).toBeVisible();
    await guest.getByTestId('register-file').setInputFiles({ name: 'id.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await expect(guest.getByText('Upload a JPG, PNG or WebP photo')).toBeVisible();

    // A valid submission.
    await guest.getByLabel('Phone number').fill('98765 11223');
    await guest.getByLabel('Full name').fill('Isha Verma');
    await guest.getByLabel('Age').fill('31');
    await guest.getByLabel('ID type').selectOption('national_id');
    await guest.getByTestId('register-file').setInputFiles({ name: 'id.png', mimeType: 'image/png', buffer: TINY_PNG });
    await guest.getByRole('button', { name: 'Submit registration' }).click();
    await expect(guest.getByTestId('register-thanks')).toContainText('Isha');

    // The page that just collected an ID cannot show anything back: no stored data in its text.
    expect(await guest.locator('body').innerText()).not.toMatch(/Neha Bhatt|Daniel Okafor|data:image/);
    const submitted = await guest.evaluate(() => JSON.parse(localStorage.getItem('folio.demo.db')!).qrRegistrations.find((r: { name: string }) => r.name === 'Isha Verma'));
    expect(submitted).toMatchObject({ status: 'pending', phone: '98765 11223', age: 31, idType: 'national_id' });
    expect(submitted.idDocument).toMatch(/^data:image\/jpeg;base64,/);
    expect(guestErrors).toEqual([]);

    // Bring the submission to the staff browser (a real backend would just have it).
    await page.evaluate((row) => {
      const db = JSON.parse(localStorage.getItem('folio.demo.db')!);
      db.qrRegistrations.push(row);
      localStorage.setItem('folio.demo.db', JSON.stringify(db));
    }, submitted);
    await phone.close();

    await page.goto('/app/front-desk?tab=registrations');
    const section = page.locator('section.panel').filter({ hasText: 'QR registrations' }).last();
    await expect(section.getByText('Isha Verma')).toBeVisible();
    await expect(section.getByText('Neha Bhatt')).toBeVisible();
    await expect(page.getByRole('tab', { name: /QR registrations/ }).locator('.count')).toHaveText('5');
    await expect(section.locator('img[alt^="ID document"], .gd-thumb img').first()).toBeVisible();

    await section.getByRole('row').filter({ hasText: 'Isha Verma' }).getByRole('button', { name: 'Review' }).click();
    const review = dialog(page, 'Verify registration');
    await expect(review.getByTestId('id-document')).toBeVisible();
    await expect(review.getByText('Visible to front desk staff only')).toBeVisible();
    // The ID number must be entered by staff from the document.
    await review.getByRole('button', { name: 'Verify and check in' }).click();
    await expect(review.getByText('ID number is required')).toBeVisible();
    await review.getByLabel('Last name').fill('Verma-Shah'); // Staff correct a detail.
    await review.getByLabel('ID number').fill('XXXX 4410');
    await review.getByRole('button', { name: 'Verify and check in' }).click();
    await toast(page, /Isha verified/);

    // Continues straight into check-in with the guest already recognised.
    const walkIn = dialog(page, 'Walk-in booking');
    await expect(walkIn.getByTestId('lookup-returning')).toBeVisible();
    await expect(walkIn.getByLabel('Last name')).toHaveValue('Verma-Shah');
    await expect(walkIn.getByLabel('ID number')).toHaveValue('XXXX 4410');
    await expect(walkIn.getByLabel('Age (optional)')).toHaveValue('31');
    await walkIn.getByLabel('Room allocation').selectOption({ index: 1 });
    await walkIn.getByRole('button', { name: 'Create and check in' }).click();
    await toast(page, /Walk-in checked in/);

    const state = await readDb(page, (db) => ({
      reg: (db.qrRegistrations as unknown as { name: string; status: string; guestId: string }[]).find((r) => r.name === 'Isha Verma'),
      guest: (db.guests as unknown as { id: string; lastName: string; idNumber: string }[]),
    }));
    expect(state.reg?.status).toBe('verified');
    expect(state.guest.find((g) => g.id === state.reg?.guestId)).toMatchObject({ lastName: 'Verma-Shah', idNumber: 'XXXX 4410' });
    expect(errors).toEqual([]);
  });

  test('a returning guest\'s QR submission updates their record instead of duplicating it', async ({ page }) => {
    await signIn(page, 'reception');
    await page.goto('/app/front-desk?tab=registrations');
    const row = page.getByRole('row').filter({ hasText: 'Vikram Rao' });
    await row.getByRole('button', { name: 'Review' }).click();
    const review = dialog(page, 'Verify registration');
    await expect(review.getByText('Matches a saved guest')).toBeVisible();
    await review.getByRole('button', { name: /Use ID on file/ }).click();
    await expect(review.getByLabel('ID number')).toHaveValue('Z7XXXX41');
    const before = await readDb(page, (db) => db.guests.length);
    await review.getByRole('button', { name: 'Verify', exact: true }).click();
    await toast(page, /verified and saved/);
    expect(await readDb(page, (db) => db.guests.length)).toBe(before);
  });

  test('rejecting a registration marks it and removes it from pending', async ({ page }) => {
    await signIn(page, 'reception');
    await page.goto('/app/front-desk?tab=registrations');
    await page.getByRole('row').filter({ hasText: 'Kavya Nair' }).getByRole('button', { name: 'Review' }).click();
    await dialog(page, 'Verify registration').getByRole('button', { name: 'Reject' }).click();
    await page.getByRole('dialog', { name: 'Reject this registration?' }).getByRole('button', { name: 'Reject' }).click();
    await toast(page, /rejected/);
    await expect(page.getByRole('row').filter({ hasText: 'Kavya Nair' })).toHaveCount(0);
  });

  test('the public page refuses a wrong token and never lists registrations; unauthenticated staff pages stay protected', async ({ page }) => {
    await page.goto('/register/not-a-real-token');
    await expect(page.getByTestId('register-invalid')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Neha Bhatt');
    await page.goto('/app/front-desk?tab=registrations');
    await expect(page).toHaveURL(/\/login/);
  });

  test('housekeeping cannot open the QR registrations', async ({ page }) => {
    await signIn(page, 'housekeeping');
    await page.goto('/app/front-desk?tab=registrations');
    await expect(page.getByText('Not part of this role')).toBeVisible();
    await expect(page.getByText('Neha Bhatt')).toHaveCount(0);
  });
});

test.describe('AI Guest Insights: loyalty', () => {
  test('shows the four categories with counts and percentages that add up, frequent guests, and seasonal patterns', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'admin');
    await page.goto('/app/ai/guest-insights');
    const panel = page.getByTestId('loyalty-panel');
    await expect(panel).toBeVisible();
    let total = 0;
    for (const [id, name] of [['new', 'New'], ['returning', 'Returning'], ['regular', 'Regular'], ['vip', 'VIP']] as const) {
      const card = page.getByTestId(`loyalty-${id}`);
      await expect(card.getByRole('heading', { name })).toBeVisible();
      total += parseInt((await card.locator('header b').innerText()).replace('%', ''), 10);
      await expect(card).toContainText('Guests');
    }
    expect(total).toBe(100);
    await expect(page.getByRole('heading', { name: 'Most frequent guests' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Ananya Iyer' })).toContainText('14');
    await expect(page.getByRole('row').filter({ hasText: 'Ananya Iyer' })).toContainText(/days ago/);
    for (const label of ['Couples', 'Families', 'Business', 'Groups']) await expect(page.locator('.ai-segment h3', { hasText: label }).first()).toBeVisible();
    await expect(page.getByTestId('season-summer')).toContainText('families');
    await expect(page.getByText('How far ahead guests book')).toBeVisible();
    await expect(page.getByText('Simulated').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Brand logo in dark mode', () => {
  test('the same logo is drawn pure white in dark mode, same size and shape, and returns to normal in light', async ({ page }) => {
    await signIn(page, 'admin');
    const logo = page.locator('img.brand-logo');
    await expect(logo).toBeVisible();
    const measure = () => logo.evaluate((el: HTMLImageElement) => {
      const box = el.getBoundingClientRect();
      return { src: el.getAttribute('src'), filter: getComputedStyle(el).filter, w: box.width, h: box.height };
    });
    const light = await measure();
    expect(light.filter).toBe('none');

    // Pixels exactly as the browser paints them, with the element's filter applied: alpha is the logo's shape.
    const paint = () => logo.evaluate(async (el: HTMLImageElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = el.naturalWidth;
      canvas.height = el.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = getComputedStyle(el).filter;
      ctx.drawImage(el, 0, 0);
      return Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
    });
    const lightPx = await paint();

    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(async () => (await measure()).filter).toContain('invert(1)');
    const dark = await measure();
    expect(dark.src).toBe(light.src); // The very same image file, not a substitute.
    expect(dark.w).toBeCloseTo(light.w, 1);
    expect(dark.h).toBeCloseTo(light.h, 1);

    const darkPx = await paint();
    expect(darkPx.length).toBe(lightPx.length);
    let visible = 0;
    for (let i = 0; i < darkPx.length; i += 4) {
      expect(darkPx[i + 3]).toBe(lightPx[i + 3]); // Same silhouette, pixel for pixel.
      if (darkPx[i + 3] > 0) {
        visible++;
        expect([darkPx[i], darkPx[i + 1], darkPx[i + 2]]).toEqual([255, 255, 255]);
      }
    }
    expect(visible).toBeGreaterThan(200);

    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect.poll(async () => (await measure()).filter).toBe('none');
  });
});
