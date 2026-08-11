import { describe, it, expect } from 'vitest';
import {
  validHandles,
  isValidHandle,
  buildLookbookQuery,
  readAliasedProducts,
  chunkHandles,
  HANDLES_PER_REQUEST,
} from '../../src/lookbook/api/query.js';

describe('handle validation', () => {
  it('accepts ordinary Shopify handles', () => {
    expect(isValidHandle('merino-crew-knit')).toBe(true);
    expect(isValidHandle('tee2')).toBe(true);
    expect(isValidHandle('4-panel-cap')).toBe(true);
  });

  it('rejects an attempt to inject GraphQL syntax', () => {
    // Handles are interpolated into the query document, so a value carrying quotes
    // or braces must never reach it.
    expect(isValidHandle('foo") { id } x: product(handle: "bar')).toBe(false);
    expect(isValidHandle('foo"bar')).toBe(false);
    expect(isValidHandle('{malicious}')).toBe(false);
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
    const input = [
      'good-handle',
      'bad handle',
      'also-good',
      'worse") { id } y: product(handle: "x',
    ];
    expect(validHandles(input)).toEqual(['good-handle', 'also-good']);
  });

  it('returns an empty array when given a non-array', () => {
    expect(validHandles(undefined)).toEqual([]);
  });
});

describe('buildLookbookQuery', () => {
  it('looks each handle up exactly, one alias per handle', () => {
    // This is the whole reason the module exists. products(query:) is a full-text
    // search on the Storefront API, not an exact match, and silently returns only
    // some of the requested handles.
    const query = buildLookbookQuery(['a-shirt', 'b-coat']);

    expect(query).toContain('p0: product(handle: "a-shirt")');
    expect(query).toContain('p1: product(handle: "b-coat")');
    expect(query).not.toContain('products(');
  });

  it('requests market context, which is what makes per-market pricing work', () => {
    const query = buildLookbookQuery(['a-shirt']);
    expect(query).toContain('@inContext(country: $country, language: $language)');
  });

  it('asks for compare-at price, required for market compare-at overrides', () => {
    expect(buildLookbookQuery(['a-shirt'])).toContain('compareAtPriceRange');
  });

  it('asks for image dimensions, which prevent layout shift', () => {
    const query = buildLookbookQuery(['a-shirt']);
    expect(query).toContain('width');
    expect(query).toContain('height');
  });

  it('quotes handles so the document cannot be broken by the value', () => {
    expect(buildLookbookQuery(['a-shirt'])).toContain('"a-shirt"');
  });
});

describe('readAliasedProducts', () => {
  it('reads aliases back in the order the handles were requested', () => {
    const data = {
      p0: { handle: 'a-shirt' },
      p1: { handle: 'b-coat' },
      p2: { handle: 'c-belt' },
    };

    const products = readAliasedProducts(data, ['a-shirt', 'b-coat', 'c-belt']);
    expect(products.map((p) => p.handle)).toEqual(['a-shirt', 'b-coat', 'c-belt']);
  });

  it('drops handles that resolved to null rather than leaving a gap', () => {
    const data = { p0: { handle: 'a-shirt' }, p1: null, p2: { handle: 'c-belt' } };

    const products = readAliasedProducts(data, ['a-shirt', 'deleted', 'c-belt']);
    expect(products.map((p) => p.handle)).toEqual(['a-shirt', 'c-belt']);
  });

  it('returns an empty array when there is no data', () => {
    expect(readAliasedProducts(null, ['a-shirt'])).toEqual([]);
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
