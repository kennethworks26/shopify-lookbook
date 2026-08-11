import { formatMoney, isOnSale, discountPercent } from './lib/money.js';

/**
 * A single product tile within a lookbook.
 *
 * Every price rendered here came from the Storefront API with `@inContext` applied,
 * so it is already the correct amount for the shopper's market. Nothing in this
 * component does arithmetic on money beyond computing a display-only discount badge.
 */
export function ProductCard({ product, showVendor, showPrice, showCompareAt, rootUrl = '/' }) {
  /*
   * `availableForSale` is fetched but deliberately not rendered as a badge.
   *
   * Under `@inContext(country:)` this store reports false for every product in
   * every market, while reporting true with no market context and while the Admin
   * API reports the variant as available. Market-context availability resolves
   * against a market web presence, which a development store without configured
   * domains does not have.
   *
   * Stock status is not part of this feature's brief, and a "Sold out" badge on
   * every tile driven by a field that is wrong here would be worse than no badge.
   * The field stays in the query so the data is there when a real store needs it.
   */
  const price = product.priceRange?.minVariantPrice;
  const compareAt = product.compareAtPriceRange?.maxVariantPrice;
  const onSale = showCompareAt && isOnSale(price, compareAt);

  return (
    <article className="group flex flex-col">
      <a
        // `rootUrl` comes from Liquid's `routes.root_url`. On a multi-market store
        // Shopify serves localized paths like /en-jp/products/..., so hardcoding
        // "/products/" would drop a Japanese shopper out of their locale on click.
        href={`${rootUrl}products/${product.handle}`}
        className="block focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lookbook-ink"
      >
        <div className="relative overflow-hidden bg-lookbook-surface">
          {product.featuredImage ? (
            <img
              src={product.featuredImage.url}
              alt={product.featuredImage.altText || product.title}
              /*
               * Intrinsic dimensions come from the API so the browser can reserve
               * the right box before the image loads. Without them a lookbook grid
               * is one of the worst CLS offenders on a page.
               */
              width={product.featuredImage.width}
              height={product.featuredImage.height}
              loading="lazy"
              decoding="async"
              className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="aspect-[3/4] w-full bg-lookbook-line" />
          )}

          {onSale && (
            <span className="absolute left-3 top-3 bg-lookbook-sale px-2 py-1 text-xs font-medium tracking-wide text-white">
              {discountPercent(price, compareAt)}% off
            </span>
          )}
        </div>

        <div className="pt-3">
          {showVendor && product.vendor && (
            <p className="text-xs uppercase tracking-wider text-lookbook-muted">{product.vendor}</p>
          )}

          <h3 className="mt-1 text-sm font-medium text-lookbook-ink">{product.title}</h3>

          {showPrice && price && (
            <p className="mt-1 flex items-baseline gap-2 text-sm">
              <span className={onSale ? 'text-lookbook-sale' : 'text-lookbook-ink'}>
                {formatMoney(price.amount, price.currencyCode)}
              </span>

              {onSale && (
                <span className="text-lookbook-muted line-through">
                  {formatMoney(compareAt.amount, compareAt.currencyCode)}
                  {/* The strikethrough alone carries no meaning for a screen reader. */}
                  <span className="sr-only"> was</span>
                </span>
              )}
            </p>
          )}
        </div>
      </a>
    </article>
  );
}
