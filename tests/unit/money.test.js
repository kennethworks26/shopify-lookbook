import { describe, it, expect } from 'vitest';
import { formatMoney, isOnSale, discountPercent } from '../../src/lookbook/lib/money.js';

describe('formatMoney', () => {
  it('formats AUD with two decimal places', () => {
    expect(formatMoney('129.00', 'AUD', 'en-AU')).toBe('$129.00');
  });

  it('formats JPY with no decimal places', () => {
    // The requirement this protects: JPY is a zero-decimal currency. Hardcoding
    // two decimals anywhere would render "19,800.00", which is not a real price.
    const formatted = formatMoney('19800', 'JPY', 'en-AU');

    expect(formatted).toContain('19,800');
    expect(formatted).not.toContain('.00');
  });

  it('uses the local currency symbol when the locale is Japanese', () => {
    // Currency *symbol* is locale-dependent, not currency-dependent: en-AU renders
    // JPY as "JPY 19,800" because ¥ is ambiguous outside Japan, while ja-JP renders
    // "￥19,800". Shopify sets <html lang> per market language, so a shopper in the
    // Japanese market gets the symbol they expect without any special-casing here.
    expect(formatMoney('19800', 'JPY', 'ja-JP')).toContain('19,800');
    expect(formatMoney('19800', 'JPY', 'ja-JP')).toMatch(/[¥￥]/);
  });

  it('does not convert between currencies', () => {
    // Same numeric amount, different currency codes. If any conversion crept in,
    // these would no longer share a numeric part.
    expect(formatMoney('100', 'AUD', 'en-AU')).toContain('100');
    expect(formatMoney('100', 'JPY', 'en-AU')).toContain('100');
  });

  it('returns an empty string for a non-numeric amount', () => {
    expect(formatMoney('not-a-price', 'AUD', 'en-AU')).toBe('');
  });

  it('returns an empty string when the currency code is missing', () => {
    expect(formatMoney('129.00', '', 'en-AU')).toBe('');
  });

  it('degrades readably rather than throwing on an unknown currency code', () => {
    // An invalid code would otherwise throw inside render and blank the whole card.
    expect(formatMoney('129', 'NOPE', 'en-AU')).toBe('NOPE 129');
  });
});

describe('isOnSale', () => {
  it('is true when compare-at is strictly higher', () => {
    expect(isOnSale({ amount: '90.00' }, { amount: '129.00' })).toBe(true);
  });

  it('is false when compare-at equals the price', () => {
    // Shopify returns compare-at whenever it is set, including when a market price
    // override has moved the price up to meet it. "Was $129, now $129" reads as a bug.
    expect(isOnSale({ amount: '129.00' }, { amount: '129.00' })).toBe(false);
  });

  it('is false when compare-at is lower than the price', () => {
    // Happens when a market price list overrides one figure but not the other.
    // Rendering it would advertise a fake discount.
    expect(isOnSale({ amount: '150.00' }, { amount: '129.00' })).toBe(false);
  });

  it('is false when either value is missing', () => {
    expect(isOnSale(null, { amount: '129.00' })).toBe(false);
    expect(isOnSale({ amount: '129.00' }, null)).toBe(false);
  });
});

describe('discountPercent', () => {
  it('rounds to a whole percentage', () => {
    expect(discountPercent({ amount: '90.00' }, { amount: '129.00' })).toBe(30);
  });

  it('is zero when not on sale', () => {
    expect(discountPercent({ amount: '129.00' }, { amount: '129.00' })).toBe(0);
  });
});
