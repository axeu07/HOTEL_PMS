import { expect, test, type Page } from '@playwright/test';
import jsQR from 'jsqr';
import { newestFirst, reviewsInPeriod, summarizeReviews } from '../src/domain/reviews';
import type { GuestReview } from '../src/types/domain';
import { readDb, signIn, watchErrors } from './helpers';

const TOKEN = 'vc7k2m9qx4hd';
const DB = 'folio.demo.db';

/** Replaces the stored reviews, then reloads so the page reads them. */
async function setReviews(page: Page, reviews: Partial<GuestReview>[]) {
  await page.evaluate(([key, rows]) => {
    const db = JSON.parse(localStorage.getItem(key as string)!);
    db.guestReviews = (rows as Partial<GuestReview>[]).map((r, i) => ({
      id: `t-${i}`, hotelId: 'hotel-1', comment: '', guestName: '', roomNumber: '', submissionKey: `k-${i}-xxxxxxxx`,
      createdAt: new Date().toISOString(), ...r,
    }));
    localStorage.setItem(key as string, JSON.stringify(db));
  }, [DB, reviews] as const);
  await page.reload();
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

test.describe('Guest Experience dashboard', () => {
  test('shows hotel reviews only: no restaurant orders, and every figure comes from the stored reviews', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'admin');
    await page.goto('/app/quick-actions?category=guest-experience');
    await expect(page.getByTestId('review-average')).toBeVisible();

    await expect(page.locator('.qa-item')).toHaveCount(0);
    await expect(page.getByText(/room service|KOT|Pending guest requests/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Generate Review QR' })).toBeVisible();

    const stored = await readDb(page, (db) => db.guestReviews as unknown as GuestReview[]);
    const want = summarizeReviews(stored);
    expect(want.count).toBeGreaterThan(5);
    await expect(page.getByTestId('review-total')).toHaveText(String(want.count));
    await expect(page.getByTestId('review-average')).toHaveText(want.average!.toFixed(1));
    for (const n of [1, 2, 3, 4, 5] as const) {
      await expect(page.getByTestId(`review-dist-count-${n}`)).toHaveText(String(want.distribution[n]));
    }
    expect(errors).toEqual([]);
  });

  test('average, distribution and filters are calculated from the reviews, not fixed', async ({ page }) => {
    await signIn(page, 'admin');
    await setReviews(page, [
      { rating: 5, createdAt: daysAgo(0), guestName: 'Asha Rao', roomNumber: '204', comment: 'Superb' },
      { rating: 4, createdAt: daysAgo(2) },
      { rating: 4, createdAt: daysAgo(10) },
      { rating: 1, createdAt: daysAgo(40), comment: 'Noisy' },
    ]);
    await page.goto('/app/quick-actions?category=guest-experience');
    await expect(page.getByTestId('review-average')).toHaveText('3.5');
    await expect(page.getByTestId('review-total')).toHaveText('4');
    await expect(page.getByTestId('review-dist-count-4')).toHaveText('2');
    await expect(page.getByTestId('review-dist-count-2')).toHaveText('0');

    // Guest name, room, rating, comment and date all show on the card.
    const card = page.getByTestId('review-item').filter({ hasText: 'Asha Rao' });
    await expect(card).toContainText('Room 204');
    await expect(card).toContainText('5/5');
    await expect(card).toContainText('Superb');

    // Rating filter narrows the list but not the distribution.
    await page.getByRole('button', { name: '4 stars' }).click();
    await expect(page.getByTestId('review-item')).toHaveCount(2);
    await expect(page.getByTestId('review-total')).toHaveText('4');
    await page.getByRole('button', { name: 'All ratings' }).click();

    // Date filter changes the figures too: last 7 days holds the 5 and one 4.
    await page.getByLabel('Date range').selectOption('7');
    await expect(page.getByTestId('review-total')).toHaveText('2');
    await expect(page.getByTestId('review-average')).toHaveText('4.5');
    await page.getByLabel('Date range').selectOption('30');
    await expect(page.getByTestId('review-total')).toHaveText('3');
    await page.getByLabel('Date range').selectOption('all');
    await page.getByRole('button', { name: '1 star' }).click();
    await expect(page.getByTestId('review-item')).toHaveCount(1);
    await expect(page.getByTestId('review-item')).toContainText('Noisy');
  });

  test('with no reviews it says so instead of inventing a score', async ({ page }) => {
    await signIn(page, 'admin');
    await setReviews(page, []);
    await page.goto('/app/quick-actions?category=guest-experience');
    await expect(page.getByText('No reviews yet')).toBeVisible();
    await expect(page.getByTestId('review-average')).toHaveCount(0);
  });

  test('other Quick Actions categories still work and the tab can be left again', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/quick-actions?category=guest-experience');
    await page.getByRole('tab', { name: /^Finance/ }).click();
    await expect(page.locator('.qa-item').first()).toBeVisible();
    await expect(page.getByTestId('review-average')).toHaveCount(0);
  });

  test('the review tab follows the existing permission for the category', async ({ page }) => {
    await signIn(page, 'housekeeping');
    await page.goto('/app/quick-actions');
    await expect(page.getByRole('tab', { name: /^Guest Experience/ })).toHaveCount(0);
  });
});

test.describe('review QR', () => {
  test('the QR opens the hotel review page and really decodes to it', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/quick-actions?category=guest-experience');
    await page.getByRole('button', { name: 'Generate Review QR' }).click();
    const qr = page.getByTestId('review-qr');
    await expect(qr).toBeVisible();
    const url = `${new URL(page.url()).origin}/review/${TOKEN}`;
    await expect(qr).toHaveAttribute('data-url', url);
    await expect(page.getByTestId('review-url')).toHaveText(url);
    // The link carries the public token, never the internal hotel id.
    expect(url).not.toContain('hotel-1');

    // Rasterise exactly what is on screen and read it back like a phone camera would.
    const px = await qr.evaluate(async (img: HTMLImageElement) => {
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
    const decoded = jsQR(new Uint8ClampedArray(px.data), px.size, px.size);
    expect(decoded?.data).toBe(url);

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    expect((await download).suggestedFilename()).toMatch(/review-qr\.png$/);
    await expect(page.getByRole('button', { name: 'Print' })).toBeEnabled();
  });
});

test.describe('guest review page', () => {
  test('a guest can rate and submit on a phone with no sign-in, and staff then see it', async ({ browser }) => {
    const guestCtx = await browser.newContext({ viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true });
    const guest = await guestCtx.newPage();
    const errors = watchErrors(guest);
    await guest.goto(`/review/${TOKEN}`);

    await expect(guest.getByRole('heading', { level: 1 })).toHaveText('How was your stay at HOTEL PMS?');
    const faces = guest.getByRole('radio');
    await expect(faces).toHaveCount(5);
    const names = await faces.evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
    expect(names).toEqual(['1 – Very Bad', '2 – Bad', '3 – Okay', '4 – Good', '5 – Excellent']);
    const emojis = await guest.locator('.gr-emoji').allInnerTexts();
    expect(emojis).toEqual(['😞', '🙁', '😐', '🙂', '🤩']);

    // Nothing sideways on a small screen, and no product chrome or internal data on the page.
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(guest.locator('.sidebar')).toHaveCount(0);

    // Submitting without a rating asks for one and stores nothing.
    await guest.getByRole('button', { name: 'Submit Review' }).click();
    await expect(guest.getByRole('alert')).toContainText('choose how your stay was');

    await guest.getByRole('radio', { name: '2 – Bad' }).click();
    await expect(guest.getByTestId('review-message')).toContainText('sorry');
    await guest.getByRole('radio', { name: '5 – Excellent' }).click();
    await expect(guest.getByRole('radio', { name: '5 – Excellent' })).toHaveAttribute('aria-checked', 'true');
    await expect(guest.getByRole('radio', { name: '2 – Bad' })).toHaveAttribute('aria-checked', 'false');
    await expect(guest.getByTestId('review-message')).toContainText('wonderful');

    await guest.getByLabel(/Tell us more/).fill('Lake view at dawn was magical.');
    await guest.getByLabel(/Your name/).fill('Meera Iyer');
    await guest.getByLabel(/^Room/).fill('305');
    // A frantic double tap must not store two reviews.
    await guest.getByRole('button', { name: 'Submit Review' }).dblclick();
    await expect(guest.getByTestId('review-thanks')).toBeVisible();
    await expect(guest.getByTestId('review-thanks')).toContainText('Thank you');

    const saved = await readDb(guest, (db) => (db.guestReviews as unknown as GuestReview[]).filter((r) => r.comment.includes('magical')));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ hotelId: 'hotel-1', rating: 5, guestName: 'Meera Iyer', roomNumber: '305' });
    expect(Number.isNaN(Date.parse(saved[0].createdAt))).toBe(false);
    expect(errors).toEqual([]);

    // Staff in the same browser see it, newest first, in the totals.
    const staff = await guestCtx.newPage();
    await signIn(staff, 'admin');
    await staff.goto('/app/quick-actions?category=guest-experience');
    const first = staff.getByTestId('review-item').first();
    await expect(first).toContainText('Meera Iyer');
    await expect(first).toContainText('Room 305');
    await expect(first).toContainText('magical');
    await guestCtx.close();
  });

  test('an unknown or malformed link shows a calm error and no hotel data', async ({ page }) => {
    for (const bad of ['nonsense1234', 'x', 'hotel-1']) {
      await page.goto(`/review/${bad}`);
      await expect(page.getByTestId('review-invalid')).toBeVisible();
      await expect(page.getByText('HOTEL PMS')).toHaveCount(0);
    }
  });

  test('a review sent while the dashboard is open appears there live', async ({ browser }) => {
    const ctx = await browser.newContext();
    const staff = await ctx.newPage();
    await signIn(staff, 'admin');
    await staff.goto('/app/quick-actions?category=guest-experience');
    const before = Number(await staff.getByTestId('review-total').innerText());

    const guest = await ctx.newPage();
    await guest.goto(`/review/${TOKEN}`);
    await guest.getByRole('radio', { name: '3 – Okay' }).click();
    await guest.getByRole('button', { name: 'Submit Review' }).click();
    await expect(guest.getByTestId('review-thanks')).toBeVisible();

    await expect(staff.getByTestId('review-total')).toHaveText(String(before + 1));
    await ctx.close();
  });
});

test.describe('pure rules', () => {
  const r = (rating: number, createdAt: string): GuestReview => ({ id: createdAt, hotelId: 'h', rating: rating as 1, comment: '', guestName: '', roomNumber: '', submissionKey: createdAt, createdAt });

  test('summary maths', () => {
    const s = summarizeReviews([r(5, 'a'), r(4, 'b'), r(4, 'c'), r(1, 'd')]);
    expect(s).toEqual({ count: 4, average: 3.5, distribution: { 1: 1, 2: 0, 3: 0, 4: 2, 5: 1 } });
    expect(summarizeReviews([])).toEqual({ count: 0, average: null, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
  });

  test('date windows include today, and a custom range is inclusive', () => {
    const now = new Date(2026, 10, 5, 15, 0);
    const at = (m: number, d: number, h = 9) => new Date(2026, m, d, h).toISOString();
    const all = [r(2, at(9, 20)), r(3, at(10, 1)), r(4, at(10, 4)), r(5, at(10, 5, 1))];
    expect(reviewsInPeriod(all, { preset: '7', from: '', to: '' }, now)).toHaveLength(3);
    expect(reviewsInPeriod(all, { preset: '30', from: '', to: '' }, now)).toHaveLength(4);
    expect(reviewsInPeriod(all, { preset: 'custom', from: '2026-11-04', to: '2026-11-05' }, now)).toHaveLength(2);
    expect(newestFirst(all)[0].rating).toBe(5);
  });
});

test.describe('review service rules (server-side checks, run directly)', () => {
  // The services run in memory under Node, with localStorage stood in for so rate limits can be counted.
  const store = new Map<string, string>();
  test.beforeAll(() => {
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });

  const key = () => `key-${Math.random().toString(36).slice(2, 12)}`;

  test('rejects bad ratings, bad tokens and oversized text', async () => {
    const { publicReviewService, reviewService } = await import('../src/services');
    const before = (await reviewService.list()).length;
    for (const rating of [0, 6, 3.5, NaN, -1]) {
      await expect(publicReviewService.submit(TOKEN, { rating, submissionKey: key() })).rejects.toThrow(/rating/i);
    }
    await expect(publicReviewService.submit('nope-nope-nope', { rating: 5, submissionKey: key() })).rejects.toThrow(/not valid/);
    await expect(publicReviewService.submit(TOKEN, { rating: 5, comment: 'x'.repeat(5000), submissionKey: key() })).rejects.toThrow(/under/);
    await expect(publicReviewService.submit(TOKEN, { rating: 5, submissionKey: '' })).rejects.toThrow();
    expect((await reviewService.list()).length).toBe(before);
  });

  test('the same form sent twice is stored once, and a honeypot fill is dropped', async () => {
    const { publicReviewService, reviewService } = await import('../src/services');
    const before = (await reviewService.list()).length;
    const k = key();
    await publicReviewService.submit(TOKEN, { rating: 4, comment: 'Lovely  \u0007stay', submissionKey: k });
    await publicReviewService.submit(TOKEN, { rating: 4, comment: 'Lovely stay', submissionKey: k });
    await publicReviewService.submit(TOKEN, { rating: 1, submissionKey: key(), website: 'http://spam.example' });
    const list = await reviewService.list();
    expect(list.length).toBe(before + 1);
    expect(list.find((x) => x.submissionKey === k)?.comment).toBe('Lovely stay');
  });

  test('too many reviews from one device in an hour are refused', async () => {
    const { publicReviewService, RATE_LIMIT } = await import('../src/services');
    store.clear();
    for (let i = 0; i < RATE_LIMIT.max; i++) await publicReviewService.submit(TOKEN, { rating: 5, submissionKey: key() });
    await expect(publicReviewService.submit(TOKEN, { rating: 5, submissionKey: key() })).rejects.toThrow(/try again later/);
    store.clear();
  });

  test('hotels never see each other’s reviews, and the public lookup reveals only name, tagline and city', async () => {
    const { publicReviewService, reviewService } = await import('../src/services');
    const { repositories } = await import('../src/repositories');
    const [first] = await repositories.hotels.list();
    await repositories.hotels.create({ ...first, id: 'hotel-2', name: 'Other Inn', reviewToken: 'zz9other8token' });
    await publicReviewService.submit('zz9other8token', { rating: 1, comment: 'Belongs to Other Inn', submissionKey: key() });

    const all = await repositories.guestReviews.list();
    const other = all.filter((x) => x.hotelId === 'hotel-2');
    expect(other).toHaveLength(1);
    // The staff view is the signed-in hotel's alone.
    expect((await reviewService.list()).some((x) => x.hotelId !== first.id || x.comment.includes('Other Inn'))).toBe(false);
    // Same key at another hotel is a different review, not a duplicate.
    const shared = key();
    await publicReviewService.submit('zz9other8token', { rating: 2, submissionKey: shared });
    await publicReviewService.submit(TOKEN, { rating: 3, submissionKey: shared });
    expect((await repositories.guestReviews.list()).filter((x) => x.submissionKey === shared)).toHaveLength(2);

    expect(await publicReviewService.hotel('zz9other8token')).toEqual({ name: 'Other Inn', tagline: first.tagline, city: first.city });
    expect(Object.keys((await publicReviewService.hotel(TOKEN))!).sort()).toEqual(['city', 'name', 'tagline']);
    store.clear();
  });
});
