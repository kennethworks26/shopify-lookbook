import { describe, it, expect } from 'vitest';
import { sortByHandleOrder, missingHandles } from '../../src/lookbook/lib/sort.js';

const products = [
  { handle: 'c-scarf', title: 'Scarf' },
  { handle: 'a-knit', title: 'Knit' },
  { handle: 'b-belt', title: 'Belt' },
];

describe('sortByHandleOrder', () => {
  it('restores the merchandiser order regardless of what the API returned', () => {
    // `products(query:)` gives no ordering guarantee, but a lookbook is a curated
    // sequence — the merchandiser's order is the product.
    const ordered = sortByHandleOrder(products, ['a-knit', 'b-belt', 'c-scarf']);
    expect(ordered.map((p) => p.handle)).toEqual(['a-knit', 'b-belt', 'c-scarf']);
  });

  it('drops handles that did not resolve rather than leaving a gap', () => {
    const ordered = sortByHandleOrder(products, ['a-knit', 'deleted-product', 'b-belt']);
    expect(ordered.map((p) => p.handle)).toEqual(['a-knit', 'b-belt']);
  });

  it('returns an empty array when nothing resolved', () => {
    expect(sortByHandleOrder([], ['a-knit'])).toEqual([]);
  });

  it('tolerates bad input instead of throwing mid-render', () => {
    expect(sortByHandleOrder(null, ['a'])).toEqual([]);
    expect(sortByHandleOrder(products, null)).toEqual([]);
  });
});

describe('missingHandles', () => {
  it('reports handles that did not come back', () => {
    expect(missingHandles(products, ['a-knit', 'ghost', 'also-ghost'])).toEqual([
      'ghost',
      'also-ghost',
    ]);
  });

  it('reports nothing when every handle resolved', () => {
    expect(missingHandles(products, ['a-knit', 'b-belt'])).toEqual([]);
  });

  it('treats an empty result as everything missing', () => {
    expect(missingHandles([], ['a-knit'])).toEqual(['a-knit']);
  });
});
