import { LOOKBOOK_PRODUCTS_QUERY, buildHandleQuery, chunkHandles, validHandles } from './query.js';
import { sortByHandleOrder } from '../lib/sort.js';

/**
 * Storefront API client for the lookbook island.
 *
 * Scope is deliberately narrow: one query, called from the browser with a public
 * Storefront access token. That token is designed to be publicly visible — it grants
 * only `unauthenticated_read_product_listings`, the same data any visitor can already
 * see. The Admin API token is a different credential entirely and never comes near
 * the theme.
 */

class StorefrontError extends Error {
  constructor(message, { status, errors } = {}) {
    super(message);
    this.name = 'StorefrontError';
    this.status = status;
    this.errors = errors;
  }
}

/**
 * Execute one GraphQL request against the Storefront API.
 *
 * @param {object} options
 * @param {string} options.domain        e.g. "example.myshopify.com"
 * @param {string} options.token         public Storefront access token
 * @param {string} options.apiVersion    pinned, e.g. "2026-07"
 * @param {string} options.query
 * @param {object} options.variables
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<object>} the `data` payload
 */
async function request({ domain, token, apiVersion, query, variables, signal }) {
  const response = await fetch(`https://${domain}/api/${apiVersion}/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
    signal,
  });

  if (!response.ok) {
    throw new StorefrontError(`Storefront API returned ${response.status}`, {
      status: response.status,
    });
  }

  const payload = await response.json();

  // GraphQL reports errors with HTTP 200, so a healthy status is not success.
  if (payload.errors?.length) {
    throw new StorefrontError(payload.errors[0].message, { errors: payload.errors });
  }

  return payload.data;
}

/**
 * Retry once on failure.
 *
 * One retry, not an escalating backoff: this runs in front of a shopper waiting for
 * a section to paint. A transient network blip deserves a second attempt; a genuine
 * outage deserves a fast, quiet failure rather than a section that spins for ten
 * seconds. Aborts are never retried — an abort means the component unmounted.
 */
async function withRetry(fn, { signal } = {}) {
  try {
    return await fn();
  } catch (error) {
    if (error.name === 'AbortError' || signal?.aborted) throw error;
    return fn();
  }
}

/**
 * Fetch the products of a lookbook, in the merchandiser's order.
 *
 * @param {object} options
 * @param {string[]} options.handles     product handles, in display order
 * @param {string} options.domain
 * @param {string} options.token
 * @param {string} options.apiVersion
 * @param {string} options.country       ISO 3166-1 alpha-2, drives market pricing
 * @param {string} options.language      ISO 639-1
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Array<object>>}
 */
export async function fetchLookbookProducts({
  handles,
  domain,
  token,
  apiVersion,
  country,
  language,
  signal,
}) {
  const safe = validHandles(handles);
  if (safe.length === 0) return [];

  const batches = chunkHandles(safe);

  const responses = await Promise.all(
    batches.map((batch) =>
      withRetry(
        () =>
          request({
            domain,
            token,
            apiVersion,
            query: LOOKBOOK_PRODUCTS_QUERY,
            variables: {
              query: buildHandleQuery(batch),
              first: batch.length,
              country: country.toUpperCase(),
              language: language.toUpperCase(),
            },
            signal,
          }),
        { signal }
      )
    )
  );

  const products = responses.flatMap((data) => data?.products?.nodes ?? []);

  // Batching and the API's own ordering both scramble the sequence; `safe` is the
  // merchandiser's order and is the one that matters.
  return sortByHandleOrder(products, safe);
}

export { StorefrontError };
