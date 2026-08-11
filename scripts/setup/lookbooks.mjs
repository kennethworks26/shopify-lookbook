#!/usr/bin/env node
/**
 * Seed three lookbooks, deliberately overlapping.
 *
 * The overlap is the point. `quilted-liner-jacket` belongs to all three, so its
 * product page is the live proof of the brief's "maximum of two" rule: it must
 * render Autumn Layers (priority 10) and Weekend Edit (20), and never Monochrome
 * Study (30). A reviewer can check that in about five seconds, which is worth more
 * than any amount of prose claiming it works.
 *
 * Priorities are spaced by ten so a merchandiser can insert a lookbook between two
 * existing ones without renumbering everything.
 *
 * Idempotent: matches on metaobject handle, updates fields in place, creates when
 * absent.
 *
 * Usage: npm run setup:lookbooks
 */
import { createClient, assertNoUserErrors, log, fail } from './lib/admin.mjs';

const TYPE = 'lookbook';

/** The product deliberately present in every lookbook. */
const ANCHOR = 'quilted-liner-jacket';

const LOOKBOOKS = [
  {
    handle: 'autumn-layers',
    title: 'Autumn Layers',
    priority: 10,
    description:
      'Transitional weight, worn together. Pieces that hold their shape under a coat and still read on their own.',
    productHandles: [
      'wool-overcoat',
      'merino-crew-knit',
      ANCHOR,
      'pleated-trouser',
      'cashmere-scarf',
    ],
  },
  {
    handle: 'weekend-edit',
    title: 'Weekend Edit',
    priority: 20,
    description: 'Looser cuts and softer finishes, for the days that ask less of you.',
    productHandles: ['linen-camp-shirt', 'wide-leg-jean', ANCHOR, 'suede-loafer'],
  },
  {
    handle: 'monochrome-study',
    title: 'Monochrome Study',
    priority: 30,
    description:
      'One palette, worked across weights and textures. The lowest priority of the three — which is why it never appears on a product page alongside the other two.',
    productHandles: ['ribbed-tank', 'silk-slip-dress', 'leather-tote', ANCHOR],
  },
];

const BY_HANDLE = `
  query LookbookByHandle($handle: MetaobjectHandleInput!) {
    metaobjectByHandle(handle: $handle) { id handle }
  }
`;

const CREATE = `
  mutation CreateLookbook($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

const UPDATE = `
  mutation UpdateLookbook($id: ID!, $metaobject: MetaobjectUpdateInput!) {
    metaobjectUpdate(id: $id, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

/**
 * Build the field list.
 *
 * Every value is a string, including the list and the integer — the metaobject
 * API takes `value` as a string and parses it against the field's declared type.
 * A list field expects a JSON array; passing a comma-joined string silently
 * produces a single-element list containing the whole thing.
 */
function fields(lookbook) {
  return [
    { key: 'title', value: lookbook.title },
    {
      key: 'description',
      // rich_text_field expects Shopify's rich text JSON document, not raw HTML.
      value: JSON.stringify({
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: lookbook.description }],
          },
        ],
      }),
    },
    { key: 'product_handles', value: JSON.stringify(lookbook.productHandles) },
    { key: 'priority', value: String(lookbook.priority) },
  ];
}

async function main() {
  const query = createClient();

  log.step(`Lookbooks: ${LOOKBOOKS.length}`);

  for (const lookbook of LOOKBOOKS) {
    const existing = (await query(BY_HANDLE, { handle: { type: TYPE, handle: lookbook.handle } }))
      .metaobjectByHandle;

    if (existing) {
      const result = await query(UPDATE, {
        id: existing.id,
        metaobject: {
          fields: fields(lookbook),
          capabilities: { publishable: { status: 'ACTIVE' } },
        },
      });
      assertNoUserErrors(result.metaobjectUpdate, `metaobjectUpdate ${lookbook.handle}`);
      log.updated(`${lookbook.handle} (priority ${lookbook.priority})`);
    } else {
      const result = await query(CREATE, {
        metaobject: {
          type: TYPE,
          handle: lookbook.handle,
          fields: fields(lookbook),
          capabilities: { publishable: { status: 'ACTIVE' } },
        },
      });
      assertNoUserErrors(result.metaobjectCreate, `metaobjectCreate ${lookbook.handle}`);
      log.created(`${lookbook.handle} (priority ${lookbook.priority})`);
    }

    log.info(`${lookbook.productHandles.length} products: ${lookbook.productHandles.join(', ')}`);
  }

  log.info('');
  log.info(`"${ANCHOR}" is in all three lookbooks.`);
  log.info('Its product page must render Autumn Layers and Weekend Edit only.');
  log.done('Lookbooks ready.');
}

main().catch((error) => fail(error.message));
