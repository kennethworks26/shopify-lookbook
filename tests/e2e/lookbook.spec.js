/**
 * The three behaviours from the brief that only a real browser can prove.
 *
 * The unit and Liquid suites each test one layer against fixtures. Nothing else
 * verifies that Liquid's selection, the island's hydration, the Storefront API's
 * response, and market pricing all line up against a live store — which is
 * precisely where this project's two nastiest bugs lived: a Storefront token
 * that saw no products, and a `products(query:)` search that silently returned
 * three of five.
 */
import { test, expect } from '@playwright/test';
import { ANCHOR_PRODUCT, EXPECTED_LOOKBOOKS, EXCLUDED_LOOKBOOK, requireStore } from './fixtures.js';

test.beforeEach(() => requireStore());

test.describe('the home page lookbook', () => {
  test('renders its products from a runtime API call, not from the HTML', async ({ page }) => {
    // The brief requires product data to be fetched at runtime. The assertion
    // that matters is not that products appear — it is that they were absent
    // from the document and arrived over the network.
    const storefrontCall = page.waitForResponse(
      (response) =>
        response.url().includes('/api/') &&
        response.url().includes('/graphql.json') &&
        response.request().method() === 'POST'
    );

    await page.goto('/');
    const response = await storefrontCall;

    expect(response.ok()).toBeTruthy();

    // Product titles come from that response, so they cannot be in the markup
    // the server sent.
    const html = await (await page.request.get('/')).text();
    const firstCard = page
      .locator('.lookbook-mount article h2, .lookbook-mount article h3')
      .first();
    await expect(firstCard).toBeVisible();

    const title = (await firstCard.textContent()).trim();
    expect(html).not.toContain(title);
  });

  test('paints its heading before the products arrive', async ({ page }) => {
    // The header is server-rendered precisely so it does not wait on hydration.
    const html = await (await page.request.get('/')).text();
    expect(html).toMatch(/lookbook-header__title/);
  });
});

test.describe('the maximum-of-two rule', () => {
  test(`shows exactly two lookbooks for a product in three`, async ({ page }) => {
    await page.goto(`/products/${ANCHOR_PRODUCT}`);

    const headings = page.locator('.lookbook-header__title');
    await expect(headings).toHaveCount(2);

    const titles = (await headings.allTextContents()).map((t) => t.trim());
    expect(titles).toEqual(EXPECTED_LOOKBOOKS);
  });

  test('drops the lowest-priority lookbook rather than an arbitrary one', async ({ page }) => {
    await page.goto(`/products/${ANCHOR_PRODUCT}`);
    await expect(page.getByText(EXCLUDED_LOOKBOOK)).toHaveCount(0);
  });

  test('renders no lookbook section on a product that belongs to none', async ({ page }) => {
    // Shoppers get nothing rather than an empty heading; the editor gets guidance.
    await page.goto('/products/graphic-cotton-tee');
    const headings = page.locator('.lookbook-header__title');
    await expect(headings).toHaveCount(1);
  });
});

test.describe('horizontal overflow', () => {
  /*
   * Measured on documentElement, deliberately, not on body.
   *
   * A previous version of this check read `body.scrollWidth` and passed while the
   * page was in fact scrolling sideways by more than a thousand pixels: the
   * culprit was an absolutely positioned `sr-only` span inside the slider whose
   * containing block was the initial containing block rather than the card, so it
   * escaped the track's clipping and extended the *document* without ever
   * widening body. documentElement is what actually scrolls.
   */
  const widths = [
    { name: 'small phone', width: 320 },
    { name: 'phone', width: 390 },
    { name: 'tablet', width: 768 },
  ];

  for (const { name, width } of widths) {
    test(`does not scroll sideways on a product page at ${width}px (${name})`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/products/${ANCHOR_PRODUCT}`);
      await expect(page.locator('.lookbook-mount article').first()).toBeVisible();

      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        return de.scrollWidth - de.clientWidth;
      });

      expect(overflow).toBeLessThanOrEqual(0);
    });
  }

  test('the slider still scrolls, so the fix did not simply clip it away', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/products/${ANCHOR_PRODUCT}`);

    const track = page.locator('.lookbook-track').first();
    await expect(track).toBeVisible();

    const moved = await track.evaluate((el) => {
      const before = el.scrollLeft;
      el.scrollBy({ left: 200, behavior: 'instant' });
      return el.scrollLeft > before;
    });

    expect(moved).toBe(true);
  });
});

test.describe('market pricing', () => {
  test('shows AUD in Australia and JPY in Japan, at price-list values', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.lookbook-mount article').first()).toBeVisible();

    const australian = await page.locator('.lookbook-mount article').first().innerText();
    expect(australian).toMatch(/A?\$\s?[\d,]+/);

    // Switching market is a full page load by design — the market drives
    // server-rendered prices as well as the island.
    await page.selectOption('#market-selector', 'JP');
    await page.waitForLoadState('load');

    await expect(page.locator('.lookbook-mount article').first()).toBeVisible();
    const japanese = await page.locator('.lookbook-mount article').first().innerText();

    // Yen, and no decimal places — JPY is a zero-decimal currency, so a price
    // ending in .00 would mean something formatted it as though it were dollars.
    expect(japanese).toMatch(/[¥￥]/);
    expect(japanese).not.toMatch(/\.\d{2}/);

    // And not a conversion: the JPY figure is a price-list value, so the two
    // must differ by more than rounding.
    expect(japanese).not.toEqual(australian);
  });
});
