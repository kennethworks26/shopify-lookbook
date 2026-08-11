#!/usr/bin/env node
/**
 * Seed the demo fashion catalog.
 *
 * A lookbook is a visual feature, so the imagery is not decoration — it is the
 * thing being demonstrated. Placeholder colour swatches would make a correct
 * implementation look unfinished. Photographs are pulled from Unsplash by URL at
 * seed time; Shopify fetches and stores its own copy, so the storefront never
 * depends on a third-party host at runtime.
 *
 * Prices are the AUD figures the store is meant to trade in. If the store's
 * currency is still USD when this runs, seed anyway: changing store currency
 * relabels the numbers rather than converting them, so 129.00 becomes A$129.00
 * once the currency is switched. No reseed required.
 *
 * Idempotent: matches on handle, updates what exists, creates what does not.
 *
 * Usage: npm run setup:catalog
 */
import { createClient, assertNoUserErrors, log, fail, sleep } from './lib/admin.mjs';

const VENDOR = 'Atelier Southbank';
const IMAGE_BASE = 'https://images.unsplash.com';

/** Build a stable, reasonably sized Unsplash URL. */
const image = (id) => `${IMAGE_BASE}/${id}?auto=format&fit=crop&w=1400&q=80`;

/**
 * The catalog.
 *
 * `compareAtPrice` is set on a few items only. That is deliberate: it gives the
 * storefront both cases to render, and it is what makes the JPY compare-at
 * overrides in setup:markets visibly different from a straight conversion.
 */
const PRODUCTS = [
  {
    handle: 'merino-crew-knit',
    title: 'Merino Crew Knit',
    type: 'Knitwear',
    price: '229.00',
    description:
      'A fine-gauge crew in Australian merino, knitted for weight without bulk. Cut close through the body with a ribbed collar that holds its shape.',
    imageId: 'photo-1591047139829-d91aecb6caea',
    alt: 'Model wearing a fine-gauge merino crew neck knit',
  },
  {
    handle: 'wool-overcoat',
    title: 'Wool Overcoat',
    type: 'Outerwear',
    price: '689.00',
    compareAtPrice: '849.00',
    description:
      'A single-breasted overcoat in a wool-cashmere melton. Fully lined, with a clean shoulder and a length that sits just below the knee.',
    imageId: 'photo-1539533018447-63fcce2678e3',
    alt: 'Model wearing a long single-breasted wool overcoat',
  },
  {
    handle: 'pleated-trouser',
    title: 'Pleated Trouser',
    type: 'Trousers',
    price: '279.00',
    description:
      'A high-rise trouser with a single forward pleat, tapered through the leg. Cut in a dry wool suiting that holds a crease.',
    imageId: 'photo-1594633312681-425c7b97ccd1',
    alt: 'Model wearing high-rise pleated wool trousers',
  },
  {
    handle: 'oversized-shirt',
    title: 'Oversized Poplin Shirt',
    type: 'Shirting',
    price: '189.00',
    description:
      'Cotton poplin cut generously through the body and shoulder, with a soft collar and a dropped sleeve.',
    imageId: 'photo-1521572163474-6864f9cf17ab',
    alt: 'Model wearing an oversized white poplin shirt',
  },
  {
    handle: 'silk-slip-dress',
    title: 'Silk Slip Dress',
    type: 'Dresses',
    price: '419.00',
    description:
      'A bias-cut slip in sandwashed silk, finished with adjustable straps and a low back.',
    imageId: 'photo-1595777457583-95e059d581b8',
    alt: 'Model wearing a bias-cut silk slip dress',
  },
  {
    handle: 'leather-tote',
    title: 'Structured Leather Tote',
    type: 'Bags',
    price: '549.00',
    description:
      'Vegetable-tanned leather with a structured base and rolled handles. Unlined, so it takes on the shape of what it carries.',
    imageId: 'photo-1584917865442-de89df76afd3',
    alt: 'Structured tan leather tote bag',
  },
  {
    handle: 'cashmere-scarf',
    title: 'Cashmere Scarf',
    type: 'Accessories',
    price: '159.00',
    compareAtPrice: '199.00',
    description: 'A wide, brushed cashmere scarf with hand-knotted fringing.',
    imageId: 'photo-1520903920243-00d872a2d1c9',
    alt: 'Folded brushed cashmere scarf',
  },
  {
    handle: 'linen-camp-shirt',
    title: 'Linen Camp Shirt',
    type: 'Shirting',
    price: '169.00',
    description: 'Washed linen with an open camp collar and a straight, boxy hem.',
    imageId: 'photo-1596755094514-f87e34085b2c',
    alt: 'Model wearing a washed linen camp collar shirt',
  },
  {
    handle: 'wide-leg-jean',
    title: 'Wide Leg Jean',
    type: 'Denim',
    price: '239.00',
    description: 'Rigid Japanese denim, cut high and full through the leg with a raw hem.',
    imageId: 'photo-1541099649105-f69ad21f3246',
    alt: 'Model wearing high-rise wide leg jeans',
  },
  {
    handle: 'suede-loafer',
    title: 'Suede Loafer',
    type: 'Footwear',
    price: '389.00',
    description: 'An unlined suede loafer on a leather sole, with a softly rounded apron.',
    imageId: 'photo-1533867617858-e7b97e060509',
    alt: 'Pair of suede loafers',
  },
  {
    handle: 'ribbed-tank',
    title: 'Ribbed Cotton Tank',
    type: 'Jersey',
    price: '89.00',
    description: 'A fine-ribbed cotton tank with a scooped neck, cut to sit close.',
    imageId: 'photo-1618354691373-d851c5c3a990',
    alt: 'Model wearing a fine-ribbed cotton tank top',
  },
  {
    /*
     * The anchor of the whole demo. This product is deliberately placed in all
     * three lookbooks by setup:lookbooks, so its product page is the live proof
     * that the max-two rule works: it must render Autumn Layers and Weekend Edit,
     * never Monochrome Study.
     */
    handle: 'quilted-liner-jacket',
    title: 'Quilted Liner Jacket',
    type: 'Outerwear',
    price: '349.00',
    compareAtPrice: '429.00',
    description:
      'A lightweight quilted liner that works alone or under a coat. Snap front, ribbed cuffs, and a collarless neck so it layers flat.',
    imageId: 'photo-1608234807905-4466023792f5',
    alt: 'Model wearing a lightweight quilted liner jacket',
  },
];

const PRODUCT_BY_HANDLE = `
  query ProductByHandle($handle: String!) {
    productByHandle(handle: $handle) { id title media(first: 1) { nodes { id } } }
  }
`;

const PRODUCT_CREATE = `
  mutation CreateProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
    productCreate(product: $product, media: $media) {
      product { id handle variants(first: 1) { nodes { id } } }
      userErrors { field message }
    }
  }
`;

const PRODUCT_UPDATE = `
  mutation UpdateProduct($product: ProductUpdateInput!) {
    productUpdate(product: $product) {
      product { id handle variants(first: 1) { nodes { id } } }
      userErrors { field message }
    }
  }
`;

const VARIANTS_UPDATE = `
  mutation UpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price compareAtPrice }
      userErrors { field message }
    }
  }
`;

const PUBLICATIONS = `
  query Publications { publications(first: 10) { nodes { id name } } }
`;

const PUBLISH = `
  mutation Publish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors { field message }
    }
  }
`;

function productInput(product) {
  return {
    handle: product.handle,
    title: product.title,
    descriptionHtml: `<p>${product.description}</p>`,
    vendor: VENDOR,
    productType: product.type,
    status: 'ACTIVE',
    tags: ['lookbook-demo'],
  };
}

async function main() {
  const query = createClient();

  log.step(`Catalog: ${PRODUCTS.length} products`);

  // Products must be published to the Online Store or the Storefront API will not
  // return them — the token only grants access to *published* product listings.
  const onlineStore = (await query(PUBLICATIONS)).publications.nodes.find(
    (node) => node.name === 'Online Store'
  );

  if (!onlineStore) fail('No Online Store publication found on this shop.');

  for (const product of PRODUCTS) {
    const existing = (await query(PRODUCT_BY_HANDLE, { handle: product.handle })).productByHandle;

    let productId;
    let variantId;

    if (existing) {
      const result = await query(PRODUCT_UPDATE, {
        product: { id: existing.id, ...productInput(product) },
      });
      assertNoUserErrors(result.productUpdate, `productUpdate ${product.handle}`);

      productId = result.productUpdate.product.id;
      variantId = result.productUpdate.product.variants.nodes[0]?.id;
      log.updated(product.handle);
    } else {
      const result = await query(PRODUCT_CREATE, {
        product: productInput(product),
        media: [
          {
            originalSource: image(product.imageId),
            alt: product.alt,
            mediaContentType: 'IMAGE',
          },
        ],
      });
      assertNoUserErrors(result.productCreate, `productCreate ${product.handle}`);

      productId = result.productCreate.product.id;
      variantId = result.productCreate.product.variants.nodes[0]?.id;
      log.created(`${product.handle} — ${product.title}`);
    }

    if (variantId) {
      const result = await query(VARIANTS_UPDATE, {
        productId,
        variants: [
          {
            id: variantId,
            price: product.price,
            // Explicit null clears a stale compare-at on re-runs, so the script
            // converges on the declared state rather than only adding to it.
            compareAtPrice: product.compareAtPrice ?? null,
          },
        ],
      });
      assertNoUserErrors(result.productVariantsBulkUpdate, `variants ${product.handle}`);
    }

    const published = await query(PUBLISH, {
      id: productId,
      input: [{ publicationId: onlineStore.id }],
    });
    assertNoUserErrors(published.publishablePublish, `publish ${product.handle}`);

    // Media ingestion is asynchronous and the API is rate limited; a short pause
    // keeps a 12-product seed comfortably inside the leaky bucket.
    await sleep(250);
  }

  log.info(`Vendor: ${VENDOR}`);
  log.info('Images are fetched by Shopify and stored on its CDN at seed time.');
  log.done('Catalog ready.');
}

main().catch((error) => fail(error.message));
