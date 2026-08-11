// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { Liquid } from 'liquidjs';
import path from 'node:path';

/**
 * Tests for the "maximum of two lookbooks" rule.
 *
 * These run the real `theme/snippets/lookbook-match.liquid` rather than a JavaScript
 * reimplementation of it. Testing a copy of the rule would pass happily while the
 * shipped Liquid drifted away from it, which defeats the point — this is the single
 * behaviour in the brief most likely to be probed in review.
 *
 * `lookbook-mount` is stubbed to print the matched lookbook's handle, so assertions
 * can be made on which lookbooks were selected and in what order.
 */

// Resolved from the project root, which is where Vitest runs.
const snippetsDir = path.resolve(process.cwd(), 'theme/snippets');
const stubsDir = path.resolve(process.cwd(), 'tests/liquid/stubs');

let engine;

beforeAll(() => {
  // Roots are searched in order, so the stub directory shadows the real
  // lookbook-mount snippet while leaving every other snippet resolving normally.
  engine = new Liquid({ root: [stubsDir, snippetsDir], extname: '.liquid' });
});

/**
 * Build a metaobject drop shaped the way Shopify exposes one to Liquid.
 */
function lookbook(handle, priority, productHandles) {
  return {
    system: { handle },
    priority: { value: priority },
    product_handles: { value: productHandles },
    title: { value: handle },
  };
}

/**
 * Shape the metaobject collection the way Shopify exposes it.
 *
 * `shop.metaobjects.lookbook` supports both iteration via `.values` and lookup by
 * handle, and the snippet uses both: it scans `.values` to find matches, then
 * resolves each winning handle back to its entry.
 */
function metaobjectCollection(lookbooks) {
  const collection = { values: lookbooks };

  for (const entry of lookbooks) {
    collection[entry.system.handle] = entry;
  }

  return collection;
}

async function render({ lookbooks, productHandle, limit = 2, designMode = false }) {
  const output = await engine.renderFile('lookbook-match', {
    product: { handle: productHandle, title: productHandle },
    limit,
    section: { settings: {} },
    request: { design_mode: designMode },
    shop: { metaobjects: { lookbook: metaobjectCollection(lookbooks) } },
  });

  return output.trim();
}

/** Extract the selected handles, in render order. */
function selected(output) {
  return [...output.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]);
}

// The seeded fixture from docs/spec.md §10: one product deliberately in all three.
const SHARED = 'limited-anorak';

const FIXTURE = [
  lookbook('monochrome-study', 30, ['everyday-tee', SHARED]),
  lookbook('autumn-layers', 10, ['merino-crew-knit', SHARED]),
  lookbook('weekend-edit', 20, ['canvas-weekender', SHARED]),
];

describe('the maximum-of-two rule', () => {
  it('renders exactly two lookbooks when a product is in three', async () => {
    const output = await render({ lookbooks: FIXTURE, productHandle: SHARED });
    expect(selected(output)).toHaveLength(2);
  });

  it('keeps the two lowest priorities and drops the third', async () => {
    // Priorities are 10, 20, 30. The fixture is deliberately declared out of order
    // so a passing result cannot come from the array's own ordering.
    const output = await render({ lookbooks: FIXTURE, productHandle: SHARED });
    expect(selected(output)).toEqual(['autumn-layers', 'weekend-edit']);
  });

  it('never renders the lowest-priority lookbook for the shared product', async () => {
    const output = await render({ lookbooks: FIXTURE, productHandle: SHARED });
    expect(selected(output)).not.toContain('monochrome-study');
  });

  it('renders one lookbook when the product is in only one', async () => {
    const output = await render({ lookbooks: FIXTURE, productHandle: 'everyday-tee' });
    expect(selected(output)).toEqual(['monochrome-study']);
  });

  it('renders nothing when the product is in no lookbook', async () => {
    const output = await render({ lookbooks: FIXTURE, productHandle: 'orphan-product' });
    expect(selected(output)).toEqual([]);
  });

  it('renders nothing when there are no lookbooks at all', async () => {
    const output = await render({ lookbooks: [], productHandle: SHARED });
    expect(selected(output)).toEqual([]);
  });

  it('honours a limit other than two', async () => {
    const output = await render({ lookbooks: FIXTURE, productHandle: SHARED, limit: 3 });
    expect(selected(output)).toEqual(['autumn-layers', 'weekend-edit', 'monochrome-study']);
  });
});

describe('ordering is deterministic', () => {
  it('sorts numerically, not lexicographically', async () => {
    // The zero-padding exists for exactly this case: as raw strings "100" sorts
    // before "20", which would invert the intended order.
    const lookbooks = [
      lookbook('priority-one-hundred', 100, [SHARED]),
      lookbook('priority-twenty', 20, [SHARED]),
    ];

    const output = await render({ lookbooks, productHandle: SHARED });
    expect(selected(output)).toEqual(['priority-twenty', 'priority-one-hundred']);
  });

  it('breaks ties on handle so equal priorities stay stable', async () => {
    const lookbooks = [lookbook('zebra-edit', 10, [SHARED]), lookbook('alpha-edit', 10, [SHARED])];

    const output = await render({ lookbooks, productHandle: SHARED });
    expect(selected(output)).toEqual(['alpha-edit', 'zebra-edit']);
  });

  it('sends lookbooks with no priority to the back rather than the front', async () => {
    // An unset priority defaults to 9999, so a merchandiser who forgets to set one
    // does not accidentally displace a deliberately prioritised lookbook.
    const lookbooks = [
      lookbook('unset-priority', null, [SHARED]),
      lookbook('explicit-priority', 50, [SHARED]),
    ];

    const output = await render({ lookbooks, productHandle: SHARED });
    expect(selected(output)[0]).toBe('explicit-priority');
  });
});

describe('merchant guidance', () => {
  it('says nothing to shoppers when the product is in no lookbook', async () => {
    const output = await render({ lookbooks: FIXTURE, productHandle: 'orphan-product' });
    expect(output).toBe('');
  });

  it('explains the empty state in the theme editor', async () => {
    const output = await render({
      lookbooks: FIXTURE,
      productHandle: 'orphan-product',
      designMode: true,
    });

    expect(output).toContain('lookbook-placeholder');
  });
});
