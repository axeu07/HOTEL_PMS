import { expect, test } from '@playwright/test';
import { signIn, watchErrors, type RoleKey } from './helpers';

const PROPERTY_PAGES: Record<RoleKey, string[]> = {
  admin: ['Rooms', 'Housekeeping', 'Guests'],
  manager: ['Rooms', 'Housekeeping', 'Guests'],
  reception: ['Rooms', 'Housekeeping', 'Guests'],
  housekeeping: ['Rooms', 'Housekeeping'],
};

test.describe('sidebar structure', () => {
  for (const role of Object.keys(PROPERTY_PAGES) as RoleKey[]) {
    test(`${role}: no headings or identity, and Property holds its permitted pages`, async ({ page }) => {
      const errors = watchErrors(page);
      await signIn(page, role);
      const sidebar = page.locator('.sidebar');
      for (const heading of ['Today', 'Business', 'Admin']) await expect(sidebar.getByText(heading, { exact: true })).toHaveCount(0);

      // Identity lives only in the header.
      const account = page.getByRole('button', { name: /Account menu for/ });
      await expect(account).toBeVisible();
      const name = (await account.locator('.who b').innerText()).trim();
      await expect(sidebar.getByText(name)).toHaveCount(0);
      await expect(sidebar.locator('.avatar')).toHaveCount(0);

      // Closed on the dashboard, its pages are out of sight and out of the tab order.
      const property = sidebar.getByRole('button', { name: 'Property', exact: true });
      await expect(property).toHaveAttribute('aria-expanded', 'false');
      const segment = page.locator('#nav-property .nav-seg');
      await expect(segment).toBeHidden();

      await property.click();
      await expect(segment).toBeVisible();
      await expect(segment.getByRole('link')).toHaveText(PROPERTY_PAGES[role]);

      // Each page reached from the control is marked current, and appears nowhere else in the nav.
      for (const label of PROPERTY_PAGES[role]) {
        const link = segment.getByRole('link', { name: label });
        await link.click();
        await expect(page).toHaveURL(new RegExp(`/app/${label.toLowerCase()}`));
        await expect(link).toHaveAttribute('aria-current', 'page');
        await expect(sidebar.getByRole('link', { name: label, exact: true })).toHaveCount(1);
        await expect(property).toHaveClass(/active/);
        await expect(page.getByText('Not part of this role')).toHaveCount(0);
      }

      // Leaving folds it away again.
      await sidebar.getByRole('link', { name: 'Dashboard' }).click();
      await expect(segment).toBeHidden();
      await expect(property).not.toHaveClass(/active/);
      expect(errors).toEqual([]);
    });
  }

  test('breadcrumbs follow the new structure', async ({ page }) => {
    await signIn(page, 'admin');
    await page.goto('/app/rooms');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText('DashboardPropertyRooms');
    await page.goto('/app/billing');
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText('DashboardFinance / Billing');
  });

  test('the name is still reachable on a phone, where the header shows only the avatar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page, 'admin');
    await expect(page.locator('.user-chip .who')).toBeHidden();
    await page.getByRole('button', { name: /Account menu for/ }).click();
    await expect(page.locator('.account-head')).toContainText('Hotel Administrator');
  });

  for (const [width, height] of [[1920, 1080], [1366, 768], [1280, 600], [1280, 500], [1280, 400], [1024, 320]]) {
    test(`everything fits with no sidebar scrolling at ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await signIn(page, 'admin');
      await page.goto('/app/rooms');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      const check = async () => {
        await page.waitForTimeout(350);
        const result = await page.locator('.sidebar').evaluate((sidebar) => {
          const overflowing = [...sidebar.querySelectorAll<HTMLElement>('a, button')]
            .filter((el) => getComputedStyle(el).visibility !== 'hidden')
            .filter((el) => {
              const box = el.getBoundingClientRect();
              return box.top < 0 || box.bottom > innerHeight + 0.5;
            })
            .map((el) => el.textContent);
          return { overflowY: getComputedStyle(sidebar).overflowY, scrolls: sidebar.scrollHeight > sidebar.clientHeight, overflowing };
        });
        expect(result).toEqual({ overflowY: 'hidden', scrolls: false, overflowing: [] });
      };

      await check();
      // The icon rail stacks the three pages, so it is the tallest arrangement.
      await page.getByRole('button', { name: 'Collapse sidebar' }).click();
      await check();
    });
  }

  test('the drawer also fits a phone held sideways', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await signIn(page, 'admin');
    await page.goto('/app/guests');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.waitForTimeout(350);
    const sidebar = page.locator('.sidebar');
    expect(await sidebar.evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(true);
    await sidebar.getByRole('link', { name: 'Finance / Billing' }).click();
    await expect(page).toHaveURL(/billing/);
  });
});

test.describe('pointer response', () => {
  test.use({ contextOptions: { reducedMotion: 'no-preference' } });

  test('the light follows the cursor without blocking clicks, and hides when it leaves', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'admin');
    const light = page.locator('.cursor-light');
    await expect(light).not.toHaveClass(/visible/);
    await page.mouse.move(700, 420);
    await expect(light).toHaveClass(/visible/);
    await expect.poll(() => light.evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return [m.m41, m.m42];
    })).toEqual([700, 420]);
    expect(await light.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    expect(await page.evaluate(() => !!document.elementFromPoint(700, 420)?.closest('.cursor-light'))).toBe(false);

    // A press goes straight through to what is underneath.
    await page.locator('.sidebar').getByRole('link', { name: 'Billing' }).click();
    await expect(page).toHaveURL(/billing/);

    await page.evaluate(() => document.documentElement.dispatchEvent(new PointerEvent('pointerleave')));
    await expect(light).not.toHaveClass(/visible/);
    expect(errors).toEqual([]);
  });

  test('a card tilts within its limit, keeps its layout, and settles when the cursor leaves', async ({ page }) => {
    await signIn(page, 'admin');
    const card = page.locator('.stat-card').first();
    // The entrance animation's transform changes offsetTop's reference point while it runs.
    await page.evaluate(() => Promise.all(document.querySelector('.page')!.getAnimations({ subtree: true }).map((a) => a.finished)));
    const layout = () => card.evaluate((el) => {
      const box = el as HTMLElement;
      return { w: box.offsetWidth, h: box.offsetHeight, t: box.offsetTop };
    });
    const before = await layout();
    const box = (await card.boundingBox())!;
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const prop = (name: string) => card.evaluate((el, n) => (el as HTMLElement).style.getPropertyValue(n), name);

    await page.mouse.move(box.x + box.width - 14, box.y + 14);
    await expect.poll(async () => parseFloat(await prop('--tilt-y'))).toBeGreaterThan(1);
    expect(Math.abs(parseFloat(await prop('--tilt-x')))).toBeLessThanOrEqual(3);
    expect(Math.abs(parseFloat(await prop('--tilt-y')))).toBeLessThanOrEqual(3);
    expect(await layout()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(pageHeight);

    // The light on the card sits at the pointer.
    expect(parseFloat(await prop('--mx'))).toBeGreaterThan(box.width / 2);

    await page.mouse.move(5, 700);
    await expect.poll(() => prop('--tilt-x')).toBe('');
    await expect(card).not.toHaveClass(/is-tilting/);
    // It returns to rest rather than stopping where it was.
    await expect.poll(() => card.evaluate((el) => {
      const m = new DOMMatrix(getComputedStyle(el).transform);
      return Math.abs(m.m13) + Math.abs(m.m23);
    })).toBeLessThan(0.001);
  });

  test('moving the mouse never re-renders the page', async ({ page }) => {
    await signIn(page, 'admin');
    await page.evaluate(() => {
      const store = window as unknown as { changes: number };
      store.changes = 0;
      new MutationObserver((list) => {
        // Chart tooltips are meant to update as the pointer crosses the chart.
        const outsideCharts = list.filter((m) => !(m.target instanceof Element ? m.target : m.target.parentElement)?.closest('.recharts-wrapper'));
        store.changes += outsideCharts.length;
      }).observe(document.querySelector('.content')!, { childList: true, subtree: true, characterData: true });
    });
    for (let i = 0; i < 40; i++) await page.mouse.move(350 + i * 20, 200 + i * 8);
    expect(await page.evaluate(() => (window as unknown as { changes: number }).changes)).toBe(0);
  });

  test('the theme crossfades, persists across a reload, and reaches the navigation', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'admin');
    const root = page.locator('html');
    const paper = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // Light is what someone with no saved preference sees.
    await expect(root).toHaveAttribute('data-theme', 'light');
    const light = await paper();
    expect(light).toBe('rgb(250, 248, 242)');
    const sideAccent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--side-accent').trim());
    expect(await sideAccent()).toBe('#187653');

    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(root).toHaveAttribute('data-theme', 'dark');
    await expect.poll(paper).not.toBe(light);
    await page.waitForTimeout(350);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(root).toHaveAttribute('data-theme', 'dark');
    expect(await sideAccent()).toBe('#62c29a');

    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(root).toHaveAttribute('data-theme', 'light');
    expect(errors).toEqual([]);
  });

  test('dropdowns play their close and then leave nothing behind', async ({ page }) => {
    await signIn(page, 'admin');
    const bell = page.getByRole('button', { name: /Notifications/ });
    await bell.click();
    await expect(page.locator('.popover')).toBeVisible();
    await bell.click();
    await expect(page.locator('.popover')).toHaveCount(0);
  });
});

test.describe('pointer effects stay out of the way', () => {
  test('reduced motion turns them off', async ({ page }) => {
    await signIn(page, 'admin');
    await expect(page.locator('.cursor-light')).toBeHidden();
    const card = page.locator('.stat-card').first();
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 20);
    await page.waitForTimeout(100);
    expect(await card.evaluate((el) => (el as HTMLElement).style.getPropertyValue('--tilt-x'))).toBe('');
    expect(await card.evaluate((el) => getComputedStyle(el).transform)).toBe('none');
  });

  test.describe('on a touch screen', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, contextOptions: { reducedMotion: 'no-preference' } });

    test('there is no cursor light or tilt, and everything still works by tapping', async ({ page }) => {
      const errors = watchErrors(page);
      await signIn(page, 'admin');
      expect(await page.evaluate(() => matchMedia('(hover: none)').matches)).toBe(true);
      const card = page.locator('.stat-grid .stat-card.is-link').first();
      await card.scrollIntoViewIfNeeded();
      await card.tap();
      await expect(page).not.toHaveURL(/dashboard/);
      await expect(page.locator('.cursor-light')).not.toHaveClass(/visible/);
      await page.getByRole('button', { name: 'Open menu' }).tap();

      // The card led to a Customers page, so that control starts open, and tapping folds it either way.
      const group = page.locator('.sidebar').getByRole('button', { name: 'Customers', exact: true });
      await expect(group).toHaveAttribute('aria-expanded', 'true');
      await group.tap();
      await expect(page.locator('#nav-customers .nav-seg')).toBeHidden();
      await group.tap();
      await page.locator('.sidebar').getByRole('link', { name: 'Stayed' }).tap();
      await expect(page).toHaveURL(/stayed/);
      await expect(page.locator('.sidebar')).not.toHaveClass(/open/);
      expect(errors).toEqual([]);
    });
  });
});

test.describe('dashboard atmosphere', () => {
  test('the revenue filter redraws the chart from the same figures', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page, 'manager');
    const chart = page.locator('[role="img"][aria-label^="Daily"]');
    await expect(chart).toHaveAttribute('aria-label', /^Daily revenue for the last 30 days/);
    await page.getByLabel('Income shown in the revenue chart').selectOption('room');
    await expect(chart).toHaveAttribute('aria-label', /^Daily room revenue for the last 30 days/);
    expect(errors).toEqual([]);
  });

  test('decoration never takes a click or appears on a printed page', async ({ page }) => {
    await signIn(page, 'manager');
    for (const selector of ['.page-waves', '.sidebar-scenery']) {
      await expect(page.locator(selector)).toBeVisible();
      expect(await page.locator(selector).evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    }
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.page-waves')).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
  });

  test('the two charts stack on a tablet and a phone', async ({ page }) => {
    await signIn(page, 'manager');
    for (const width of [820, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const columns = await page.locator('.grid-2-1').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
      expect(columns).toBe(1);
    }
  });
});

test.describe('page movement', () => {
  test('a new page starts at the top and going back returns to the same place', async ({ page }) => {
    await page.setViewportSize({ width: 1360, height: 600 });
    await signIn(page, 'admin');
    await page.goto('/app/guests');
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await page.evaluate(() => window.scrollTo({ top: 420, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(420);

    await page.locator('.sidebar').getByRole('link', { name: 'Billing' }).click();
    await expect(page).toHaveURL(/billing/);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

    await page.goBack();
    await expect(page).toHaveURL(/guests/);
    await expect(page.locator('tbody tr').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(420);
  });

  test('the sidebar and header stay still while the page scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1360, height: 600 });
    await signIn(page, 'admin');
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500);
    expect(await page.locator('.sidebar').evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
    expect(await page.locator('.topbar').evaluate((el) => el.getBoundingClientRect().top)).toBe(0);
  });
});
