#!/usr/bin/env node
/**
 * Configure the two markets the brief calls for: Australia (AUD) and Japan (JPY).
 *
 * Australia is the primary market and trades in the store's base currency, so its
 * prices are the ones seeded by setup:catalog. Japan gets an explicit catalog and
 * price list with fixed JPY prices *and* fixed JPY compare-at prices.
 *
 * The JPY figures are deliberately not a conversion of the AUD ones. Their implied
 * rates range from about 105 to 121, and on the same product the compare-at ratio
 * differs from the price ratio. That matters: if the storefront were converting
 * client-side, every product would show the same implied rate and the numbers
 * below could not appear. These prices are the evidence that the storefront reads
 * market data rather than doing arithmetic.
 *
 * JPY is a zero-decimal currency, so every amount here is a whole number.
 *
 * Idempotent: reuses the market, catalog, and price list if they already exist.
 *
 * Usage: npm run setup:markets
 */
import { createClient, assertNoUserErrors, log, fail } from './lib/admin.mjs';

const AU = { name: 'Australia', handle: 'australia', countryCode: 'AU' };
const JP = { name: 'Japan', handle: 'japan', countryCode: 'JP', currency: 'JPY' };

/**
 * Japanese retail prices, keyed by product handle.
 * `[price, compareAtPrice]` — compare-at omitted where the product is not on sale.
 */
const JPY_PRICES = {
  'camel-wool-overcoat': ['78000', '92000'],
  'rust-bomber-jacket': ['39800', '52000'],
  'tie-neck-silk-blouse': ['23800'],
  'chambray-shirt': ['18500'],
  'satin-jogger-trouser': ['32000'],
  'patched-denim-jean': ['27800'],
  'silk-evening-gown': ['46000'],
  'cotton-crew-tee': ['9800'],
  'graphic-cotton-tee': ['11200'],
  'structured-leather-bag': ['64000'],
  'monk-strap-shoe': ['44000', '53000'],
};

const MARKETS = `
  query Markets {
    markets(first: 20) {
      nodes {
        id name handle primary status
        regions(first: 20) { nodes { id name ... on MarketRegionCountry { code } } }
        catalogs(first: 10) {
          nodes { id title ... on MarketCatalog { priceList { id name currency } } }
        }
      }
    }
  }
`;

const VARIANTS = `
  query Variants {
    products(first: 50) {
      nodes { handle variants(first: 1) { nodes { id } } }
    }
  }
`;

const MARKET_CREATE = `
  mutation CreateMarket($input: MarketCreateInput!) {
    marketCreate(input: $input) {
      market { id name handle }
      userErrors { field message }
    }
  }
`;

const MARKET_UPDATE = `
  mutation UpdateMarket($id: ID!, $input: MarketUpdateInput!) {
    marketUpdate(id: $id, input: $input) {
      market { id name handle }
      userErrors { field message }
    }
  }
`;

const CATALOG_CREATE = `
  mutation CreateCatalog($input: CatalogCreateInput!) {
    catalogCreate(input: $input) {
      catalog { id title }
      userErrors { field message }
    }
  }
`;

const PRICE_LIST_CREATE = `
  mutation CreatePriceList($input: PriceListCreateInput!) {
    priceListCreate(input: $input) {
      priceList { id name currency }
      userErrors { field message }
    }
  }
`;

const FIXED_PRICES_ADD = `
  mutation AddFixedPrices($priceListId: ID!, $prices: [PriceListPriceInput!]!) {
    priceListFixedPricesAdd(priceListId: $priceListId, prices: $prices) {
      prices { compareAtPrice { amount currencyCode } price { amount currencyCode } }
      userErrors { field message }
    }
  }
`;

const money = (amount) => ({ amount, currencyCode: JP.currency });

async function ensureAustralia(query, markets) {
  // The primary market cannot be deleted and always exists. Rather than leaving a
  // stray "United States" market alongside the two the brief asks for, the primary
  // one is repointed at Australia — which is also what makes AUD the market
  // currency without any override.
  const existing = markets.find((market) => market.handle === AU.handle || market.name === AU.name);

  if (existing) {
    log.skipped(`market ${AU.name}`);
    return existing;
  }

  const primary = markets.find((market) => market.primary);
  if (!primary) fail('No primary market found on this shop.');

  const staleRegions = primary.regions.nodes
    .filter((region) => region.code !== AU.countryCode)
    .map((region) => region.id);

  const hasAu = primary.regions.nodes.some((region) => region.code === AU.countryCode);

  const result = await query(MARKET_UPDATE, {
    id: primary.id,
    input: {
      name: AU.name,
      handle: AU.handle,
      status: 'ACTIVE',
      conditions: {
        conditionsToAdd: hasAu
          ? undefined
          : { regionsCondition: { regions: [{ countryCode: AU.countryCode }] } },
        conditionsToDelete:
          staleRegions.length > 0 ? { regionsCondition: { regionIds: staleRegions } } : undefined,
      },
    },
  });

  assertNoUserErrors(result.marketUpdate, 'marketUpdate (Australia)');
  log.updated(`market ${AU.name} (was "${primary.name}")`);

  return result.marketUpdate.market;
}

async function ensureJapan(query, markets) {
  const existing = markets.find((market) => market.handle === JP.handle || market.name === JP.name);

  if (existing) {
    log.skipped(`market ${JP.name}`);
    return existing;
  }

  const result = await query(MARKET_CREATE, {
    input: {
      name: JP.name,
      handle: JP.handle,
      status: 'ACTIVE',
      conditions: {
        regionsCondition: { regions: [{ countryCode: JP.countryCode }] },
      },
      currencySettings: {
        baseCurrency: JP.currency,
        // Off deliberately. Local currency conversion is the thing this feature
        // must not rely on — prices come from the price list below.
        localCurrencies: false,
      },
    },
  });

  assertNoUserErrors(result.marketCreate, 'marketCreate (Japan)');
  log.created(`market ${JP.name} (${JP.currency})`);

  return result.marketCreate.market;
}

const CATALOG_TITLE = 'Japan catalog';
const PRICE_LIST_NAME = 'Japan JPY price list';

async function ensureJapanPriceList(query, market) {
  const catalogs = market.catalogs?.nodes ?? [];

  const withPriceList = catalogs.find((catalog) => catalog.priceList);
  if (withPriceList) {
    log.skipped(`price list ${withPriceList.priceList.name} (${withPriceList.priceList.currency})`);
    return withPriceList.priceList;
  }

  // Reuse a catalog left behind by a run that failed after creating it. Without
  // this, every retry stacks another catalog on the market.
  let catalogId = catalogs.find((catalog) => catalog.title === CATALOG_TITLE)?.id;

  if (catalogId) {
    log.skipped(`catalog ${CATALOG_TITLE}`);
  } else {
    const result = await query(CATALOG_CREATE, {
      input: { title: CATALOG_TITLE, status: 'ACTIVE', context: { marketIds: [market.id] } },
    });
    assertNoUserErrors(result.catalogCreate, 'catalogCreate (Japan)');
    catalogId = result.catalogCreate.catalog.id;
    log.created(`catalog ${CATALOG_TITLE}`);
  }

  const priceListResult = await query(PRICE_LIST_CREATE, {
    input: {
      name: PRICE_LIST_NAME,
      currency: JP.currency,
      catalogId,
      /*
       * A price list must declare how it derives from the base catalog, so a zero
       * percent adjustment is the baseline: without any fixed price, a product
       * would fall through to the converted AUD amount.
       *
       * That default is precisely what the brief asks us to override. Every
       * product below then gets an explicit JPY price on top, so what the Japanese
       * storefront shows is real Japanese retail pricing rather than arithmetic on
       * an Australian number.
       */
      parent: { adjustment: { type: 'PERCENTAGE_INCREASE', value: 0 } },
    },
  });
  assertNoUserErrors(priceListResult.priceListCreate, 'priceListCreate (Japan)');
  log.created(`price list ${PRICE_LIST_NAME} (${JP.currency})`);

  return priceListResult.priceListCreate.priceList;
}

async function main() {
  const query = createClient();

  log.step('Markets: Australia (AUD) and Japan (JPY)');

  const markets = (await query(MARKETS)).markets.nodes;

  await ensureAustralia(query, markets);

  const japan = await ensureJapan(query, markets);

  // Re-read: a market created moments ago has no catalogs on the object we hold.
  const refreshed = (await query(MARKETS)).markets.nodes.find((m) => m.id === japan.id);
  const priceList = await ensureJapanPriceList(query, refreshed ?? japan);

  log.step('Japanese prices');

  const variantByHandle = new Map(
    (await query(VARIANTS)).products.nodes.map((product) => [
      product.handle,
      product.variants.nodes[0]?.id,
    ])
  );

  const prices = [];
  for (const [handle, [price, compareAt]] of Object.entries(JPY_PRICES)) {
    const variantId = variantByHandle.get(handle);

    if (!variantId) {
      log.info(`skipped ${handle} — no such product. Run npm run setup:catalog first.`);
      continue;
    }

    prices.push({
      variantId,
      price: money(price),
      ...(compareAt ? { compareAtPrice: money(compareAt) } : {}),
    });
  }

  const result = await query(FIXED_PRICES_ADD, { priceListId: priceList.id, prices });
  assertNoUserErrors(result.priceListFixedPricesAdd, 'priceListFixedPricesAdd');

  log.created(`${prices.length} fixed JPY prices`);
  log.info('These are not conversions: implied rates range from ~105 to ~121,');
  log.info('and compare-at ratios differ from price ratios on the same product.');
  log.done('Markets ready.');
}

main().catch((error) => fail(error.message));
