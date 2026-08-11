#!/usr/bin/env node
/**
 * Create or update the `lookbook` metaobject definition.
 *
 * The definition is a data contract. The theme renders against these exact field
 * keys, and Liquid does not error on a missing field — it renders blank. Rename a
 * key here and the storefront quietly empties instead of failing loudly, which is
 * why this lives in version control rather than being clicked together in the admin.
 *
 * Idempotent: creates the definition if absent, adds any missing fields if present,
 * and reports "unchanged" when there is nothing to do.
 *
 * Usage: npm run setup:metaobjects
 */
import { createClient, assertNoUserErrors, log, fail } from './lib/admin.mjs';

const TYPE = 'lookbook';

/**
 * Field definitions, in the order merchandisers see them in the admin.
 *
 * `product_handles` is a list of plain strings rather than product references. A
 * product reference would be the better default in most designs — it survives
 * handle changes and gives referential integrity — but the brief requires the
 * lookbook to store handles only, with product data fetched at runtime through the
 * Storefront API. See docs/adr/0002-handles-not-product-references.md for the
 * tradeoff that accepts: renaming a product handle silently drops it from every
 * lookbook referencing it.
 */
const FIELDS = [
  {
    key: 'title',
    name: 'Title',
    type: 'single_line_text_field',
    description: 'Shown as the lookbook heading on the storefront.',
    required: true,
  },
  {
    key: 'description',
    name: 'Description',
    type: 'rich_text_field',
    description: 'Optional intro copy shown under the heading.',
    required: false,
  },
  {
    key: 'product_handles',
    name: 'Product handles',
    type: 'list.single_line_text_field',
    description:
      'Product handles in display order, e.g. merino-crew-knit. Find a handle at the end of the product URL. Order here is the order shoppers see.',
    required: true,
  },
  {
    key: 'priority',
    name: 'Priority',
    type: 'number_integer',
    description:
      'Lower numbers win. When a product belongs to more than two lookbooks, the two with the lowest priority are the ones shown on its product page. Use 10, 20, 30 so you can insert between them later.',
    required: true,
  },
  {
    key: 'cover_image',
    name: 'Cover image',
    type: 'file_reference',
    description: 'Optional editorial image representing the lookbook.',
    required: false,
  },
];

const DEFINITION_QUERY = `
  query LookbookDefinition($type: String!) {
    metaobjectDefinitionByType(type: $type) {
      id
      name
      fieldDefinitions { key name type { name } }
    }
  }
`;

const CREATE_MUTATION = `
  mutation CreateLookbookDefinition($definition: MetaobjectDefinitionCreateInput!) {
    metaobjectDefinitionCreate(definition: $definition) {
      metaobjectDefinition { id type fieldDefinitions { key } }
      userErrors { field message }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdateLookbookDefinition($id: ID!, $definition: MetaobjectDefinitionUpdateInput!) {
    metaobjectDefinitionUpdate(id: $id, definition: $definition) {
      metaobjectDefinition { id fieldDefinitions { key } }
      userErrors { field message }
    }
  }
`;

function fieldInput(field) {
  return {
    key: field.key,
    name: field.name,
    type: field.type,
    description: field.description,
    required: field.required,
  };
}

async function main() {
  const query = createClient();

  log.step(`Metaobject definition: ${TYPE}`);

  const existing = (await query(DEFINITION_QUERY, { type: TYPE })).metaobjectDefinitionByType;

  if (!existing) {
    const result = await query(CREATE_MUTATION, {
      definition: {
        type: TYPE,
        name: 'Lookbook',
        description:
          'A curated set of products shown together on the storefront. Place one on the home page, or let product pages surface the lookbooks a product belongs to.',
        displayNameKey: 'title',
        fieldDefinitions: FIELDS.map(fieldInput),
        // Exposed to the Storefront API so the data model stays usable by a future
        // headless build. This theme reads it through Liquid, but the definition
        // should not be the thing that blocks that later.
        access: { storefront: 'PUBLIC_READ' },
        capabilities: { publishable: { enabled: true } },
      },
    });

    assertNoUserErrors(result.metaobjectDefinitionCreate, 'metaobjectDefinitionCreate');
    log.created(`${TYPE} with ${FIELDS.length} fields`);
    log.done('Metaobject definition ready.');
    return;
  }

  // Present already: add only fields that are missing. Existing fields are left
  // alone — changing a live field's type would break entries already using it.
  const presentKeys = new Set(existing.fieldDefinitions.map((f) => f.key));
  const missing = FIELDS.filter((field) => !presentKeys.has(field.key));

  if (missing.length === 0) {
    log.skipped(`${TYPE} (all ${FIELDS.length} fields present)`);
    log.done('Metaobject definition ready.');
    return;
  }

  const result = await query(UPDATE_MUTATION, {
    id: existing.id,
    definition: {
      fieldDefinitions: missing.map((field) => ({ create: fieldInput(field) })),
    },
  });

  assertNoUserErrors(result.metaobjectDefinitionUpdate, 'metaobjectDefinitionUpdate');
  log.updated(`${TYPE}: added ${missing.map((f) => f.key).join(', ')}`);
  log.done('Metaobject definition ready.');
}

main().catch((error) => fail(error.message));
