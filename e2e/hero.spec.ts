import { expect, test, type Page } from '@playwright/test';
import { watchErrors } from './helpers';

/**
 * Playwright's scroll-into-view step can fire while the opening animation is moving a
 * button, and the page's smooth scrolling then carries the hero away mid-click. Real
 * pointer clicks during the intro are unaffected, so tests just wait for it to finish.
 */
async function introSettled(page: Page) {
  await expect(page.locator('.h3d-foot-end')).toHaveCSS('opacity', '1');
  await expect(page.locator('.h3d-foot-end')).toHaveCSS('transform', /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
}

/**
 * The test browser renders WebGL in software, which the hero treats as a low-powered
 * device, so these run against the static fallback. They hold for the 3D tiers too,
 * since the page around the canvas is the same.
 */
test.describe('landing hero', () => {
  test('shows the headline, subheading and calls to action', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hospitality, Reimagined.');
    await expect(page.getByText('One intelligent platform to manage every stay, every room and every guest experience.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore the Platform' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Launch Live Demo' })).toBeVisible();
    await expect(page.getByText('A product demonstration with a fictional hotel.')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Launch Live Demo leads to the four one-click roles', async ({ page }) => {
    await page.goto('/');
    await introSettled(page);
    await page.getByRole('link', { name: 'Launch Live Demo' }).click();
    await expect(page.getByTestId('role-admin')).toBeInViewport();
    await page.getByTestId('role-admin').getByRole('button', { name: 'Enter as Administrator' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('floating navigation reaches the demo login and stays on screen', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Site' });
    await page.getByRole('link', { name: 'Rooms', exact: true }).click();
    await expect(page.locator('#rooms')).toBeInViewport();
    await expect(nav).toBeInViewport();
    await nav.getByRole('link', { name: 'Demo login' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a signed-in visitor returns to the suite from the hero', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'One-click sign in as General Manager' }).click();
    await expect(page).toHaveURL(/dashboard/);
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Site' }).getByRole('link', { name: 'Back to the suite' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);
    await page.goto('/');
    await introSettled(page);
    await page.getByRole('link', { name: 'Launch Live Demo' }).click();
    await expect(page).toHaveURL(/\/app\/dashboard/);
  });

  test('low-powered devices get the poster and never download the 3D code', async ({ page }) => {
    const requested: string[] = [];
    page.on('request', (r) => requested.push(r.url()));
    await page.goto('/');
    const poster = page.locator('.h3d-poster');
    await expect(poster).toBeVisible();
    await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('.h3d-canvas')).toHaveCount(0);
    expect(requested.filter((url) => /HotelScene|hotel\.glb/.test(url))).toEqual([]);
  });

  test('reduced motion leaves everything in its final position', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.h3d-canvas')).toHaveCount(0);
    await expect(page.locator('.h3d-line > span').first()).toHaveCSS('transform', 'none');
    await expect(page.getByRole('link', { name: 'Launch Live Demo' })).toBeVisible();
  });

  test('every request stays on this origin', async ({ page }) => {
    const origin = new URL(test.info().project.use.baseURL!).origin;
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(origin) && !r.url().startsWith('data:')) external.push(r.url());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(external).toEqual([]);
  });

  test('call to action fits at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
    await expect(page.getByRole('link', { name: 'Launch Live Demo' })).toBeInViewport({ ratio: 1 });
    const booking = await page.locator('.booking-bar').boundingBox();
    const cta = await page.getByRole('link', { name: 'Launch Live Demo' }).boundingBox();
    expect(cta!.y + cta!.height).toBeLessThanOrEqual(booking!.y);
  });
});
