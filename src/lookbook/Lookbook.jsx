import { ProductCard } from './ProductCard.jsx';
import { useLookbookProducts } from './useLookbookProducts.js';

/**
 * Column count maps to explicit class strings rather than being interpolated.
 *
 * Tailwind resolves utilities by scanning source text, so a template literal like
 * `` `grid-cols-${n}` `` produces classes that exist at runtime but were never seen
 * at build time — they get purged, and the grid silently collapses to one column in
 * production while looking fine in dev.
 */
const DESKTOP_COLUMNS = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};

const MOBILE_COLUMNS = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
};

export function Lookbook({
  title,
  description,
  handles,
  shop,
  token,
  apiVersion,
  country,
  language,
  columnsDesktop = 4,
  columnsMobile = 2,
  showDescription = true,
  showPrice = true,
  showCompareAt = true,
  showVendor = false,
  rootUrl = '/',
  designMode = false,
}) {
  const { status, products, missing, error } = useLookbookProducts({
    handles,
    shop,
    token,
    apiVersion,
    country,
    language,
  });

  // Errors are a merchant problem, not a shopper problem. In the theme editor they
  // are spelled out; on the live storefront the section removes itself rather than
  // leaving a heading above an empty space.
  if (status === 'error') {
    return designMode ? <EditorNotice heading={title} message={error.message} /> : null;
  }

  if (status === 'ready' && products.length === 0) {
    return designMode ? (
      <EditorNotice
        heading={title}
        message={`None of this lookbook's handles matched a published product: ${handles.join(', ')}`}
      />
    ) : null;
  }

  const gridClasses = [
    'grid gap-x-4 gap-y-8',
    MOBILE_COLUMNS[columnsMobile] ?? MOBILE_COLUMNS[2],
    DESKTOP_COLUMNS[columnsDesktop] ?? DESKTOP_COLUMNS[4],
  ].join(' ');

  return (
    <section className="lookbook-root font-display" aria-busy={status === 'loading'}>
      <header className="mb-8 max-w-2xl">
        {title && (
          <h2 className="text-2xl font-medium tracking-tight text-lookbook-ink">{title}</h2>
        )}
        {showDescription && description && (
          <div
            className="mt-2 text-sm leading-relaxed text-lookbook-muted [&_a]:underline"
            /*
             * `description` is a rich_text_field rendered to HTML by Liquid before it
             * reaches the browser. The content is merchant-authored and same-origin —
             * the same trust level as any other theme content — and Shopify sanitises
             * rich text on the way in.
             */
            dangerouslySetInnerHTML={{ __html: description }}
          />
        )}
      </header>

      {status === 'loading' ? (
        <div className={gridClasses}>
          {handles.slice(0, columnsDesktop).map((handle) => (
            <div key={handle} className="animate-pulse">
              <div className="aspect-[3/4] w-full bg-lookbook-line" />
              <div className="mt-3 h-3 w-2/3 bg-lookbook-line" />
              <div className="mt-2 h-3 w-1/3 bg-lookbook-line" />
            </div>
          ))}
        </div>
      ) : (
        <ul className={gridClasses}>
          {products.map((product) => (
            <li key={product.id}>
              <ProductCard
                product={product}
                showVendor={showVendor}
                showPrice={showPrice}
                showCompareAt={showCompareAt}
                rootUrl={rootUrl}
              />
            </li>
          ))}
        </ul>
      )}

      {designMode && missing.length > 0 && (
        <p className="mt-6 border-l-2 border-lookbook-sale bg-lookbook-surface p-3 text-sm text-lookbook-ink">
          <strong>Only visible in the theme editor.</strong> These handles didn&rsquo;t match a
          published product and were skipped: {missing.join(', ')}
        </p>
      )}
    </section>
  );
}

function EditorNotice({ heading, message }) {
  return (
    <section className="lookbook-root font-display border border-dashed border-lookbook-line p-6">
      <p className="text-sm font-medium text-lookbook-ink">
        Lookbook{heading ? `: ${heading}` : ''}
      </p>
      <p className="mt-1 text-sm text-lookbook-muted">{message}</p>
      <p className="mt-3 text-xs text-lookbook-muted">
        This message appears only in the theme editor. Customers see nothing.
      </p>
    </section>
  );
}
