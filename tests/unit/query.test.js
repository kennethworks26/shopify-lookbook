import { describe, it, expect } from 'vitest';
import {
  validHandles,
  isValidHandle,
  buildHandleQuery,
  chunkHandles,
  HANDLES_PER_REQUEST,
  LOOKBOOK_PRODUCTS_QUERY,
} from '../../src/lookbook/api/query.js';

describe('handle validation', () => {
  it('accepts ordinary Shopify handles', () => {
    expect(isValidHandle('merino-crew-knit')).toBe(true);
    expect(isValidHandle('tee2')).toBe(true);
    expect(isValidHandle('4-panel-cap')).toBe(true);
  });

  it('rejects an attempt to break out of the search term', () => {
    // The reason this guard exists: handles are concatenated into the `query:`
    // search string, so a quote could close the term and append arbitrary syntax.
    expect(isValidHandle('foo" OR handle:"secret-product')).toBe(false);
    expect(isValidHandle('foo OR handle:bar')).toBe(false);
  });

  it('rejects uppercase, spaces, and leading hyphens', () => {
    expect(isValidHandle('Merino-Crew')).toBe(false);
    expect(isValidHandle('merino crew')).toBe(false);
    expect(isValidHandle('-leading-hyphen')).toBe(false);
  });

  it('rejects non-strings and empty values', () => {
    expect(isValidHandle(null)).toBe(false);
    expect(isValidHandle(42)).toBe(false);
    expect(isValidHandle('')).toBe(false);
  });

  it('filters a mixed list down to the safe handles', () => {
    const input = ['good-handle', 'bad handle', 'also-good', 'worse" OR handle:"x'];
    expect(validHandles(input)).toEqual(['good-handle', 'also-good']);
  });

  it('returns an empty array when given a non-array', () => {
    expect(validHandles(undefined)).toEqual([]);
  });
});

describe('buildHandleQuery', () => {
  it('joins handles with OR', () => {
    expect(buildHandleQuery(['a-shirt', 'b-coat'])).toBe('handle:a-shirt OR handle:b-coat');
  });

  it('handles a single entry without a trailing operator', () => {
    expect(buildHandleQuery(['solo'])).toBe('handle:solo');
  });
});

describe('chunkHandles', () => {
  it('keeps a small lookbook in one request', () => {
    expect(chunkHandles(['a', 'b', 'c'])).toEqual([['a', 'b', 'c']]);
  });

  it('splits at the batch size', () => {
    const handles = Array.from({ length: HANDLES_PER_REQUEST + 3 }, (_, i) => `p-${i}`);
    const chunks = chunkHandles(handles);

    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(HANDLES_PER_REQUEST);
    expect(chunks[1]).toHaveLength(3);
  });

  it('returns nothing for an empty list', () => {
    expect(chunkHandles([])).toEqual([]);
  });
});

describe('LOOKBOOK_PRODUCTS_QUERY', () => {
  it('requests market context, which is what makes per-market pricing work', () => {
    expect(LOOKBOOK_PRODUCTS_QUERY).toContain('@inContext(country: $country');
  });

  it('asks for compare-at price, required for market compare-at overrides', () => {
    expect(LOOKBOOK_PRODUCTS_QUERY).toContain('compareAtPriceRange');
  });

  it('asks for image dimensions, which prevent layout shift', () => {
    expect(LOOKBOOK_PRODUCTS_QUERY).toContain('width');
    expect(LOOKBOOK_PRODUCTS_QUERY).toContain('height');
  });
});
