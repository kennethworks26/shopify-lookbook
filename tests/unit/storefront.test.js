import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLookbookProducts } from '../../src/lookbook/api/storefront.js';
import { HANDLES_PER_REQUEST } from '../../src/lookbook/api/query.js';

const BASE = {
  domain: 'example.myshopify.com',
  token: 'public-storefront-token',
  apiVersion: '2026-07',
  country: 'AU',
  language: 'EN',
};

function productNode(handle, currencyCode = 'AUD', amount = '129.00') {
  return {
    id: `gid://shopify/Product/${handle}`,
    handle,
    title: handle,
    priceRange: { minVariantPrice: { amount, currencyCode } },
    compareAtPriceRange: { maxVariantPrice: { amount, currencyCode } },
  };
}

/**
 * Build an aliased response the way the Storefront API returns one: `p0`, `p1`, …
 * in the order the handles were requested, with null for anything unresolved.
 */
function okResponse(nodes) {
  const data = {};
  nodes.forEach((node, index) => {
    data[`p${index}`] = node;
  });
  return { ok: true, status: 200, json: async () => ({ data }) };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchLookbookProducts', () => {
  it('returns products in merchandiser order', async () => {
    fetch.mockResolvedValue(okResponse([productNode('a-knit'), productNode('b-belt')]));

    const result = await fetchLookbookProducts({ ...BASE, handles: ['a-knit', 'b-belt'] });

    expect(result.map((p) => p.handle)).toEqual(['a-knit', 'b-belt']);
  });

  it('looks handles up exactly rather than searching for them', async () => {
    // products(query:) is a full-text search on the Storefront API and silently
    // returns only some of the requested handles. Verified against a real store.
    fetch.mockResolvedValue(okResponse([productNode('a-knit')]));

    await fetchLookbookProducts({ ...BASE, handles: ['a-knit'] });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.query).toContain('p0: product(handle: "a-knit")');
    expect(body.query).not.toContain('products(');
  });

  it('drops a handle that resolved to null', async () => {
    fetch.mockResolvedValue(okResponse([productNode('a-knit'), null]));

    const result = await fetchLookbookProducts({ ...BASE, handles: ['a-knit', 'gone'] });

    expect(result.map((p) => p.handle)).toEqual(['a-knit']);
  });

  it('sends the country as market context', async () => {
    fetch.mockResolvedValue(okResponse([productNode('a-knit', 'JPY', '19800')]));

    await fetchLookbookProducts({ ...BASE, country: 'jp', handles: ['a-knit'] });

    const body = JSON.parse(fetch.mock.calls[0][1].body);
    // Lowercase in, uppercase out: CountryCode is an enum and the API rejects 'jp'.
    expect(body.variables.country).toBe('JP');
  });

  it('calls the pinned API version, never an unversioned endpoint', async () => {
    fetch.mockResolvedValue(okResponse([]));

    await fetchLookbookProducts({ ...BASE, handles: ['a-knit'] });

    expect(fetch.mock.calls[0][0]).toBe('https://example.myshopify.com/api/2026-07/graphql.json');
  });

  it('sends the Storefront token header', async () => {
    fetch.mockResolvedValue(okResponse([]));

    await fetchLookbookProducts({ ...BASE, handles: ['a-knit'] });

    expect(fetch.mock.calls[0][1].headers['X-Shopify-Storefront-Access-Token']).toBe(
      'public-storefront-token'
    );
  });

  it('never issues a request when every handle is unsafe', async () => {
    const result = await fetchLookbookProducts({
      ...BASE,
      handles: ['bad handle', 'worse" OR handle:"x'],
    });

    expect(result).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('splits large lookbooks across requests and merges the results', async () => {
    const handles = Array.from({ length: HANDLES_PER_REQUEST + 2 }, (_, i) => `p-${i}`);

    fetch
      .mockResolvedValueOnce(
        okResponse(handles.slice(0, HANDLES_PER_REQUEST).map((h) => productNode(h)))
      )
      .mockResolvedValueOnce(
        okResponse(handles.slice(HANDLES_PER_REQUEST).map((h) => productNode(h)))
      );

    const result = await fetchLookbookProducts({ ...BASE, handles });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(handles.length);
    expect(result.map((p) => p.handle)).toEqual(handles);
  });

  it('retries once on a transient failure', async () => {
    fetch
      .mockRejectedValueOnce(new Error('network blip'))
      .mockResolvedValueOnce(okResponse([productNode('a-knit')]));

    const result = await fetchLookbookProducts({ ...BASE, handles: ['a-knit'] });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
  });

  it('gives up after the retry rather than looping', async () => {
    fetch.mockRejectedValue(new Error('still down'));

    await expect(fetchLookbookProducts({ ...BASE, handles: ['a-knit'] })).rejects.toThrow(
      'still down'
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('treats a GraphQL error as a failure even though HTTP said 200', async () => {
    // GraphQL reports errors with a 200 status, so response.ok is not success.
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ errors: [{ message: 'Invalid API key' }] }),
    });

    await expect(fetchLookbookProducts({ ...BASE, handles: ['a-knit'] })).rejects.toThrow(
      'Invalid API key'
    );
  });

  it('surfaces an HTTP error status', async () => {
    fetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    await expect(fetchLookbookProducts({ ...BASE, handles: ['a-knit'] })).rejects.toThrow(
      'Storefront API returned 401'
    );
  });
});
