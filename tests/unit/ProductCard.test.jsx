import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductCard } from '../../src/lookbook/ProductCard.jsx';

function makeProduct(overrides = {}) {
  return {
    id: 'gid://shopify/Product/1',
    handle: 'merino-crew-knit',
    title: 'Merino Crew Knit',
    vendor: 'Atelier',
    availableForSale: true,
    featuredImage: {
      url: 'https://cdn.shopify.com/knit.jpg',
      altText: 'Model wearing the merino crew knit',
      width: 1200,
      height: 1600,
    },
    priceRange: { minVariantPrice: { amount: '129.00', currencyCode: 'AUD' } },
    compareAtPriceRange: { maxVariantPrice: { amount: '129.00', currencyCode: 'AUD' } },
    ...overrides,
  };
}

const defaults = { showVendor: true, showPrice: true, showCompareAt: true };

describe('ProductCard', () => {
  it('renders the link without a browser-default underline', () => {
    // Preflight is not imported, so nothing resets this for us. Regression guard:
    // this shipped with underlined product links once already.
    render(<ProductCard product={makeProduct()} {...defaults} />);
    expect(screen.getByRole('link').className).toContain('no-underline');
  });

  it('links to the product page', () => {
    render(<ProductCard product={makeProduct()} {...defaults} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/products/merino-crew-knit');
  });

  it('sets intrinsic image dimensions so the browser can reserve space', () => {
    // Without these the lookbook grid is a major source of layout shift.
    render(<ProductCard product={makeProduct()} {...defaults} />);
    const image = screen.getByRole('img');

    expect(image).toHaveAttribute('width', '1200');
    expect(image).toHaveAttribute('height', '1600');
  });

  it('prefers the image alt text over the product title', () => {
    render(<ProductCard product={makeProduct()} {...defaults} />);
    expect(screen.getByAltText('Model wearing the merino crew knit')).toBeInTheDocument();
  });

  it('falls back to the product title when there is no alt text', () => {
    const product = makeProduct({
      featuredImage: {
        url: 'https://cdn.shopify.com/knit.jpg',
        altText: null,
        width: 1,
        height: 1,
      },
    });

    render(<ProductCard product={product} {...defaults} />);
    expect(screen.getByAltText('Merino Crew Knit')).toBeInTheDocument();
  });

  it('renders without an image rather than breaking the grid', () => {
    render(<ProductCard product={makeProduct({ featuredImage: null })} {...defaults} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Merino Crew Knit')).toBeInTheDocument();
  });

  it('hides compare-at when it equals the price', () => {
    // Shopify returns compare-at whenever it is set. Equal values must not render
    // as a discount — see the market-override case in money.test.js.
    render(<ProductCard product={makeProduct()} {...defaults} />);
    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
  });

  it('shows the strikethrough and badge when genuinely discounted', () => {
    const product = makeProduct({
      priceRange: { minVariantPrice: { amount: '90.00', currencyCode: 'AUD' } },
      compareAtPriceRange: { maxVariantPrice: { amount: '129.00', currencyCode: 'AUD' } },
    });

    render(<ProductCard product={product} {...defaults} />);

    expect(screen.getByText('$90.00')).toBeInTheDocument();
    expect(screen.getByText(/\$129\.00/)).toBeInTheDocument();
    expect(screen.getByText('30% off')).toBeInTheDocument();
  });

  it('honours showCompareAt being switched off in section settings', () => {
    const product = makeProduct({
      priceRange: { minVariantPrice: { amount: '90.00', currencyCode: 'AUD' } },
      compareAtPriceRange: { maxVariantPrice: { amount: '129.00', currencyCode: 'AUD' } },
    });

    render(<ProductCard product={product} {...defaults} showCompareAt={false} />);

    expect(screen.getByText('$90.00')).toBeInTheDocument();
    expect(screen.queryByText(/% off/)).not.toBeInTheDocument();
  });

  it('hides the price entirely when showPrice is off', () => {
    render(<ProductCard product={makeProduct()} {...defaults} showPrice={false} />);
    expect(screen.queryByText('$129.00')).not.toBeInTheDocument();
  });

  it('hides the vendor when showVendor is off', () => {
    render(<ProductCard product={makeProduct()} {...defaults} showVendor={false} />);
    expect(screen.queryByText('Atelier')).not.toBeInTheDocument();
  });

  it('does not render a sold-out badge', () => {
    // availableForSale is unreliable under @inContext on a store whose markets have
    // no web presence: it reports false for everything. See ProductCard.jsx.
    render(<ProductCard product={makeProduct({ availableForSale: false })} {...defaults} />);
    expect(screen.queryByText('Sold out')).not.toBeInTheDocument();
    expect(screen.getByText('Merino Crew Knit')).toBeInTheDocument();
  });

  it('renders JPY market pricing exactly as the API returned it', () => {
    const product = makeProduct({
      priceRange: { minVariantPrice: { amount: '19800', currencyCode: 'JPY' } },
      compareAtPriceRange: { maxVariantPrice: { amount: '19800', currencyCode: 'JPY' } },
    });

    render(<ProductCard product={product} {...defaults} />);

    // No decimals, and no conversion from the AUD figure.
    expect(screen.getByText(/19,800/)).toBeInTheDocument();
    expect(screen.queryByText(/129/)).not.toBeInTheDocument();
  });
});
