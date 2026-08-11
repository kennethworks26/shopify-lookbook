/**
 * Money formatting for lookbook cards.
 *
 * The single rule this module exists to enforce: **never convert**. The Storefront
 * API is queried with `@inContext(country:)`, so every amount it returns has already
 * had that market's price-list overrides applied by Shopify. Converting again on the
 * client is how a storefront ends up quoting one number and charging another at
 * checkout.
 *
 * Decimal places come from locale data rather than a hardcoded 2. AUD takes two;
 * JPY takes none — ¥19,800, not ¥19,800.00.
 */

/**
 * Format an amount in the currency the Storefront API returned it in.
 *
 * @param {string|number} amount        decimal amount, e.g. "129.00"
 * @param {string} currencyCode         ISO 4217, e.g. "AUD" or "JPY"
 * @param {string} [locale]             BCP 47 tag; defaults to the document language
 * @returns {string}                    e.g. "$129.00", "¥19,800"
 */
export function formatMoney(amount, currencyCode, locale) {
  const value = Number(amount);

  if (!Number.isFinite(value) || !currencyCode) return '';

  const resolvedLocale = locale || documentLocale();

  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  } catch {
    // An invalid currency code would otherwise throw during render and blank the
    // whole card. Degrade to something readable instead.
    return `${currencyCode} ${value}`;
  }
}

/**
 * Whether a compare-at price should be shown as a strikethrough.
 *
 * Shopify returns a compare-at price whenever one is set, including when it equals
 * or undercuts the current price — which happens routinely after a market price-list
 * override changes one figure but not the other. Rendering "was $129, now $129"
 * looks broken and, where compare-at is lower, is actively misleading.
 *
 * @param {{amount: string}|null|undefined} price
 * @param {{amount: string}|null|undefined} compareAt
 * @returns {boolean}
 */
export function isOnSale(price, compareAt) {
  if (!price || !compareAt) return false;

  const current = Number(price.amount);
  const previous = Number(compareAt.amount);

  if (!Number.isFinite(current) || !Number.isFinite(previous)) return false;

  return previous > current;
}

/**
 * Percentage saved, rounded to a whole number.
 *
 * @param {{amount: string}} price
 * @param {{amount: string}} compareAt
 * @returns {number} 0 when not on sale
 */
export function discountPercent(price, compareAt) {
  if (!isOnSale(price, compareAt)) return 0;

  const current = Number(price.amount);
  const previous = Number(compareAt.amount);

  return Math.round(((previous - current) / previous) * 100);
}

function documentLocale() {
  if (typeof document === 'undefined') return 'en-AU';
  return document.documentElement.lang || 'en-AU';
}
