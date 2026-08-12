#!/usr/bin/env node
/**
 * Seed three lookbooks, deliberately overlapping.
 *
 * The overlap is the point. `rust-bomber-jacket` belongs to all three, so its
 * product page is the live proof of the brief's "maximum of two" rule: it must
 * render Autumn Layers (priority 10) and Weekend Edit (20), and never Monochrome
 * Study (30). A reviewer can check that in about five seconds, which is worth more
 * than any amount of prose claiming it works.
 *
 * Three lookbooks of eight over a catalog of eleven means products necessarily
 * appear in more than one, and several sit in all three. That is not sloppiness —
 * it is how a real store merchandises, the same coat belonging to more than one
 * edit — and it widens the proof: several product pages now exercise the cap
 * rather than one. `rust-bomber-jacket` remains the handle the e2e suite asserts
 * on, and `graphic-cotton-tee` is deliberately left in exactly one lookbook as the
 * control case.
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
const ANCHOR = 'rust-bomber-jacket';

const LOOKBOOKS = [
  {
    handle: 'autumn-layers',
    title: 'Autumn Layers',
    priority: 10,
    description:
      'Transitional weight, worn together. Pieces that hold their shape under a coat and still read on their own.',
    /*
     * Eight, and ordered head to toe: outerwear, then shirting, then knitwear,
     * then trousers, then shoes. Order is merchandising, not decoration — it is
     * preserved end to end (lib/sort.js restores it after the API, which does not
     * promise to return aliases in order), so this is the sequence a shopper sees.
     *
     * Eight also fills two clean rows at the default four columns, which is what
     * the home-page grid is sized for.
     */
    productHandles: [
      'camel-wool-overcoat',
      ANCHOR,
      'chambray-shirt',
      'tie-neck-silk-blouse',
      'cotton-crew-tee',
      'satin-jogger-trouser',
      'patched-denim-jean',
      'monk-strap-shoe',
    ],
  },
  {
    handle: 'weekend-edit',
    title: 'Weekend Edit',
    priority: 20,
    description: 'Looser cuts and softer finishes, for the days that ask less of you.',
    productHandles: [
      'chambray-shirt',
      ANCHOR,
      'cotton-crew-tee',
      'patched-denim-jean',
      'satin-jogger-trouser',
      'camel-wool-overcoat',
      'structured-leather-bag',
      'monk-strap-shoe',
    ],
  },
  {
    handle: 'monochrome-study',
    title: 'Monochrome Study',
    priority: 30,
    description:
      'One palette, worked across weights and textures. The lowest priority of the three — which is why it never appears on a product page alongside the other two.',
    productHandles: [
      'graphic-cotton-tee',
      'silk-evening-gown',
      'tie-neck-silk-blouse',
      ANCHOR,
      'cotton-crew-tee',
      'satin-jogger-trouser',
      'structured-leather-bag',
      'monk-strap-shoe',
    ],
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
