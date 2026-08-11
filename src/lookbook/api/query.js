/**
 * The GraphQL document and query-string construction for lookbook product fetches.
 */

/**
 * Shopify product handles are lowercase alphanumeric with hyphens. Anything else is
 * rejected before it reaches the search-query string.
 *
 * This matters because `products(query:)` takes a *search string*, not a typed
 * variable list, so handles are concatenated into it. An unvalidated handle
 * containing `"` could close the term and append arbitrary search syntax. The
 * Storefront API is a read-only, public-scoped surface so the blast radius is small,
 * but "small blast radius" is not a reason to build the injection in.
 */
const HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Shopify caps `first:` at 250, but a search string also has a practical length
 * limit. 25 handles per request keeps the URL comfortable and matches the largest
 * lookbook we seed, so the chunking path is exercised rather than theoretical.
 */
export const HANDLES_PER_REQUEST = 25;

export const LOOKBOOK_PRODUCTS_QUERY = /* GraphQL */ `
  query LookbookProducts(
    $query: String!
    $first: Int!
    $country: CountryCode!
    $language: LanguageCode!
  ) @inContext(country: $country, language: $language) {
    products(first: $first, query: $query) {
      nodes {
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

  return handles.filter((handle) => typeof handle === 'string' && HANDLE_PATTERN.test(handle));
}

/**
 * Whether a single handle is safe.
 *
 * @param {unknown} handle
 * @returns {boolean}
 */
export function isValidHandle(handle) {
  return typeof handle === 'string' && HANDLE_PATTERN.test(handle);
}

/**
 * Build the `query:` argument for a batch of handles.
 *
 * @param {string[]} handles  already validated
 * @returns {string}          e.g. `handle:merino-crew-knit OR handle:canvas-weekender`
 */
export function buildHandleQuery(handles) {
  return handles.map((handle) => `handle:${handle}`).join(' OR ');
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
