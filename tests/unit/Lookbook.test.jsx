import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Lookbook } from '../../src/lookbook/Lookbook.jsx';

const config = {
  title: 'Autumn Layers',
  handles: ['a-knit', 'b-belt'],
  shop: 'example.myshopify.com',
  token: 'public-token',
  apiVersion: '2026-07',
  country: 'AU',
  language: 'EN',
};

function productNode(handle, title) {
  return {
    id: `gid://shopify/Product/${handle}`,
    handle,
    title,
    vendor: 'Atelier',
    availableForSale: true,
    featuredImage: { url: `https://cdn/${handle}.jpg`, altText: title, width: 800, height: 1000 },
    priceRange: { minVariantPrice: { amount: '129.00', currencyCode: 'AUD' } },
    compareAtPriceRange: { maxVariantPrice: { amount: '129.00', currencyCode: 'AUD' } },
  };
}

/** Aliased response shape: p0, p1, … in requested order. */
function resolveWith(nodes) {
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

describe('Lookbook', () => {
  it('renders no heading — Liquid owns the header', async () => {
    // Title, description, and cover image are server-known, so they are rendered in
    // snippets/lookbook-mount.liquid and paint with the document. This component
    // owns only the grid. tests/liquid/lookbook-mount.test.js covers the header.
    fetch.mockResolvedValue(resolveWith([productNode('a-knit', 'Knit')]));

    render(<Lookbook {...config} />);

    expect(screen.queryByRole('heading')).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Knit')).toBeInTheDocument());
  });

  it('marks itself busy while loading', () => {
    fetch.mockReturnValue(new Promise(() => {}));

    const { container } = render(<Lookbook {...config} />);

    expect(container.querySelector('section')).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the products it received', async () => {
    fetch.mockResolvedValue(
      resolveWith([productNode('a-knit', 'Merino Knit'), productNode('b-belt', 'Leather Belt')])
    );

    render(<Lookbook {...config} />);

    await waitFor(() => {
      expect(screen.getByText('Merino Knit')).toBeInTheDocument();
      expect(screen.getByText('Leather Belt')).toBeInTheDocument();
    });
  });

  it('renders nothing to shoppers when the request fails', async () => {
    fetch.mockRejectedValue(new Error('offline'));

    const { container } = render(<Lookbook {...config} designMode={false} />);

    // A heading floating above an empty space is worse than no section at all.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('explains the failure in the theme editor', async () => {
    fetch.mockRejectedValue(new Error('offline'));

    render(<Lookbook {...config} designMode />);

    await waitFor(() => expect(screen.getByText(/offline/)).toBeInTheDocument());
    expect(screen.getByText(/only in the theme editor/i)).toBeInTheDocument();
  });

  it('renders nothing to shoppers when no handle resolved', async () => {
    fetch.mockResolvedValue(resolveWith([]));

    const { container } = render(<Lookbook {...config} designMode={false} />);

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('names the dead handles in the theme editor', async () => {
    fetch.mockResolvedValue(resolveWith([]));

    render(<Lookbook {...config} designMode />);

    await waitFor(() => expect(screen.getByText(/a-knit, b-belt/)).toBeInTheDocument());
  });

  it('lists partially missing handles for the merchant but still renders what resolved', async () => {
    fetch.mockResolvedValue(resolveWith([productNode('a-knit', 'Merino Knit')]));

    render(<Lookbook {...config} designMode />);

    await waitFor(() => expect(screen.getByText('Merino Knit')).toBeInTheDocument());
    expect(screen.getByText(/b-belt/)).toBeInTheDocument();
  });

  it('fails with guidance and no request when the token is missing', async () => {
    render(<Lookbook {...config} token="" designMode />);

    await waitFor(() => expect(screen.getByText(/Storefront API token/i)).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renders the grid without list markers', async () => {
    // Same reason as the link underline: no Preflight, so the <ul> keeps the
    // browser's discs and indent unless asked not to.
    fetch.mockResolvedValue(resolveWith([productNode('a-knit', 'Knit')]));

    const { container } = render(<Lookbook {...config} />);
    await waitFor(() => expect(screen.getByText('Knit')).toBeInTheDocument());

    expect(container.querySelector('ul').className).toContain('list-none');
  });

  it('uses static column classes so Tailwind does not purge them', async () => {
    // A template literal like `grid-cols-${n}` builds classes Tailwind never sees at
    // build time; they get stripped and the grid collapses in production only.
    fetch.mockResolvedValue(resolveWith([productNode('a-knit', 'Knit')]));

    const { container } = render(<Lookbook {...config} columnsDesktop={3} columnsMobile={1} />);

    await waitFor(() => expect(screen.getByText('Knit')).toBeInTheDocument());

    const grid = container.querySelector('ul');
    expect(grid.className).toContain('lg:grid-cols-3');
    expect(grid.className).toContain('grid-cols-1');
  });

  it('falls back to sane columns when given an unsupported value', async () => {
    fetch.mockResolvedValue(resolveWith([productNode('a-knit', 'Knit')]));

    const { container } = render(<Lookbook {...config} columnsDesktop={99} />);

    await waitFor(() => expect(screen.getByText('Knit')).toBeInTheDocument());
    expect(container.querySelector('ul').className).toContain('lg:grid-cols-4');
  });
});
