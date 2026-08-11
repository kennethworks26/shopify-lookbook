// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { Liquid } from 'liquidjs';
import path from 'node:path';

/**
 * Tests for the mount snippet — the boundary between Liquid and React.
 *
 * Two things happen here that nothing else covers. The header (title and
 * description) is rendered server-side so it paints with the document rather
 * than waiting on hydration, and the section's configuration is handed to
 * React as JSON in a data attribute.
 *
 * Runs the real `theme/snippets/lookbook-mount.liquid`.
 */

const snippetsDir = path.resolve(process.cwd(), 'theme/snippets');

let engine;

beforeAll(() => {
  engine = new Liquid({ root: [snippetsDir], extname: '.liquid' });

  // Liquid filters the theme gets from Shopify and liquidjs does not.
  engine.registerFilter('json', (value) => JSON.stringify(value ?? null));
  engine.registerFilter('metafield_tag', (field) => (field ? `<p>${field.rendered}</p>` : ''));
  engine.registerFilter('image_url', (image, ...args) => {
    const width = args[args.indexOf('width') + 1] ?? 1000;
    return `${image.src}?width=${width}`;
  });
});

function lookbook(overrides = {}) {
  return {
    system: { handle: 'autumn-layers' },
    title: { value: 'Autumn Layers' },
    description: { rendered: 'Transitional weight, worn together.' },
    product_handles: { value: ['camel-wool-overcoat', 'rust-bomber-jacket'] },
    priority: { value: 10 },
    ...overrides,
  };
}

async function render({
  entry = lookbook(),
  settings = {},
  designMode = false,
  headingLevel = undefined,
} = {}) {
  return (
    await engine.renderFile('lookbook-mount', {
      lookbook: entry,
      heading_level: headingLevel,
      section: {
        settings: {
          columns_desktop: 4,
          columns_mobile: '2',
          show_description: true,
          show_price: true,
          show_compare_at: true,
          show_vendor: false,
          ...settings,
        },
      },
      request: { design_mode: designMode },
      routes: { root_url: '/' },
      shop: { permanent_domain: 'example.myshopify.com' },
      settings: { storefront_api_token: 'public-token', storefront_api_version: '2026-07' },
      localization: { country: { iso_code: 'AU' }, language: { iso_code: 'EN' } },
    })
  ).trim();
}

/**
 * Pull the JSON payload React will read back out of the data attribute.
 *
 * Entities are decoded the way a browser's `getAttribute` would. Both numeric and
 * named forms are handled because liquidjs's `escape` emits `&#34;` where
 * Shopify's emits `&quot;` — a difference between the engines, not between the
 * outputs, since a browser decodes the two identically.
 */
function payload(html) {
  const raw = html.match(/data-lookbook="([^"]*)"/)[1];

  const decoded = raw
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Ampersand last, so a decoded entity cannot be decoded a second time.
    .replace(/&amp;/g, '&');

  return JSON.parse(decoded);
}

describe('the server-rendered header', () => {
  it('puts the title in the HTML, not only in the payload', async () => {
    // The whole point of rendering the header in Liquid: it paints with the
    // document instead of waiting for React to hydrate.
    const html = await render();
    expect(html).toContain('<h2 class="lookbook-header__title">Autumn Layers</h2>');
  });

  it('wraps header and mount together so two lookbooks can be spaced apart', async () => {
    // A product page renders two of these in a row. Spacing keys off this
    // wrapper; without it the only separator was an adjacent-sibling rule that
    // broke as soon as the header moved out of the mount node.
    const html = await render();
    expect(html).toContain('class="lookbook-entry"');
  });

  it('renders the description', async () => {
    const html = await render();
    expect(html).toContain('Transitional weight, worn together.');
  });

  it('omits the description when the merchant turns it off', async () => {
    const html = await render({ settings: { show_description: false } });
    expect(html).not.toContain('Transitional weight, worn together.');
    expect(html).toContain('Autumn Layers');
  });

  it('defaults to h2, for pages that already have an h1', async () => {
    // On a product page the product title holds the h1; a second one would leave
    // the page with two competing top-level headings.
    const html = await render();
    expect(html).toContain('<h2 class="lookbook-header__title">Autumn Layers</h2>');
  });

  it('uses h1 when the caller asks for it', async () => {
    // The home page is nothing but the lookbook, so its title is the page heading.
    // Without this the home page had no h1 at all.
    const html = await render({ headingLevel: 'h1' });
    expect(html).toContain('<h1 class="lookbook-header__title">Autumn Layers</h1>');
    expect(html).not.toContain('<h2 class="lookbook-header__title"');
  });
});

describe('the payload handed to React', () => {
  it('carries the handles in merchandiser order', async () => {
    expect(payload(await render()).handles).toEqual(['camel-wool-overcoat', 'rust-bomber-jacket']);
  });

  it('carries market context, which is what drives per-market pricing', async () => {
    const config = payload(await render());
    expect(config.country).toBe('AU');
    expect(config.language).toBe('EN');
  });

  it('sends columnsMobile as a number, not the select value string', async () => {
    // The setting is a select, so its raw value is "2". React indexes a lookup
    // table with it, and a type mismatch there silently collapses the grid.
    expect(payload(await render()).columnsMobile).toBe(2);
  });

  it('omits the description, since Liquid already rendered it', async () => {
    expect(payload(await render())).not.toHaveProperty('description');
  });

  it('passes the Storefront token and pinned API version', async () => {
    const config = payload(await render());
    expect(config.token).toBe('public-token');
    expect(config.apiVersion).toBe('2026-07');
  });

  it('turns merchant diagnostics on only in the theme editor', async () => {
    expect(payload(await render()).designMode).toBe(false);
    expect(payload(await render({ designMode: true })).designMode).toBe(true);
  });
});

describe('when the lookbook has no products', () => {
  it('renders nothing at all', async () => {
    const html = await render({ entry: lookbook({ product_handles: { value: [] } }) });
    expect(html).toBe('');
  });
});

describe('the no-JavaScript fallback', () => {
  it('links to each product without rendering any product data', async () => {
    // The brief requires product data to come from the Storefront API at runtime.
    // Rendering titles or prices here — even as a fallback — would work around it.
    const html = await render();

    expect(html).toContain('<noscript>');
    expect(html).toContain('/products/camel-wool-overcoat');
    expect(html).toContain('/products/rust-bomber-jacket');
  });
});
