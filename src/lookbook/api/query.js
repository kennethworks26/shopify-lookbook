/**
 * GraphQL document construction for lookbook product fetches.
 *
 * Products are looked up by exact handle, one GraphQL alias each, rather than
 * through `products(query: "handle:a OR handle:b")`.
 *
 * That search-based approach looks tidier and does not work. On the Storefront API
 * `products(query:)` is a full-text search, not an exact field match, so some
 * handles resolve and others silently do not — verified against a real store, where
 * a five-handle lookbook returned three products with a perfectly valid 200
 * response and no error. Aliased `product(handle:)` lookups are exact, return
 * results in the order asked for, and cost one point each.
 */

/**
 * Shopify product handles are lowercase alphanumeric with hyphens.
 *
 * Handles are interpolated into the query document, so they are validated first.
 * `JSON.stringify` escapes the value as well, which makes this belt and braces —
 * but a rejected handle also fails loudly in tests, which a silently escaped one
 * would not.
 */
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Aliases per request. Each `product(handle:)` costs one point against the
 * Storefront API's cost limit, so this is comfortable, and it keeps the document
 * small enough to stay readable in a network trace.
 */
export const HANDLES_PER_REQUEST = 25;

const PRODUCT_FIELDS = `
  fragment LookbookProduct on Product {
    id
    handle
    title
    vendor
    availableForSale
    featuredImage {
      url
      altText
      width
      height
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    compareAtPriceRange {
      maxVariantPrice {
        amount
        currencyCode
      }
    }
  }
`;

/**
 * Keep only handles that are safe to interpolate.
 *
 * @param {string[]} handles
 * @returns {string[]}
 */
export function validHandles(handles) {
  if (!Array.isArray(handles)) return [];

  return handles.filter(isValidHandle);
}

/**
 * @param {unknown} handle
 * @returns {boolean}
 */
export function isValidHandle(handle) {
  return typeof handle === 'string' && HANDLE_PATTERN.test(handle);
}

/**
 * Build a query fetching one product per handle, aliased `p0`, `p1`, ….
 *
 * `@inContext(country:)` is what makes market pricing work: Shopify resolves the
 * market's price-list overrides server-side, so the amounts that come back are
 * already correct for the shopper's market and need no conversion.
 *
 * @param {string[]} handles  already validated
 * @returns {string}
 */
export function buildLookbookQuery(handles) {
  const aliases = handles
    .map(
      (handle, index) =>
        `  p${index}: product(handle: ${JSON.stringify(handle)}) { ...LookbookProduct }`
    )
    .join('\n');

  return `query LookbookProducts($country: CountryCode!, $language: LanguageCode!)
@inContext(country: $country, language: $language) {
${aliases}
}
${PRODUCT_FIELDS}`;
}

/**
 * Read an aliased response back into an array, in the order the handles were asked
 * for. Handles that did not resolve come back as null and are dropped.
 *
 * @param {object} data       the GraphQL `data` payload
 * @param {string[]} handles  the handles this batch requested
 * @returns {object[]}
 */
export function readAliasedProducts(data, handles) {
  if (!data) return [];

  return handles.map((_, index) => data[`p${index}`]).filter(Boolean);
}

/**
 * Split handles into request-sized batches.
 *
 * @param {string[]} handles
 * @param {number} [size]
 * @returns {string[][]}
 */
export function chunkHandles(handles, size = HANDLES_PER_REQUEST) {
  const chunks = [];

  for (let i = 0; i < handles.length; i += size) {
    chunks.push(handles.slice(i, i + size));
  }

  return chunks;
}
