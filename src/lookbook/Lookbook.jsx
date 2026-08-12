import { ProductCard } from './ProductCard.jsx';
import { Slider } from './Slider.jsx';
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

/*
 * Slide widths, for the same build-time reason as the column maps above.
 *
 * These are deliberately fractions of the track rather than of the row: at
 * `basis-1/4` with a gap, the fourth card is pushed just past the right edge and
 * peeks. That peek is the affordance — it is what tells a shopper the row scrolls,
 * on touch devices where the buttons are the only other clue.
 */
const DESKTOP_SLIDES = {
  2: 'lg:basis-1/2',
  3: 'lg:basis-1/3',
  4: 'lg:basis-1/4',
  5: 'lg:basis-1/5',
};

const MOBILE_SLIDES = {
  1: 'basis-full',
  2: 'basis-1/2',
};

export function Lookbook({
  title,
  handles,
  shop,
  token,
  apiVersion,
  country,
  language,
  columnsDesktop = 4,
  columnsMobile = 2,
  showPrice = true,
  showCompareAt = true,
  showVendor = false,
  rootUrl = '/',
  cardHeadingLevel = 'h3',
  layout = 'grid',
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

  const isSlider = layout === 'slider';

  /*
   * `list-none` is not decoration. Preflight is deliberately not imported (see
   * docs/adr/0004-tailwind-without-preflight.md), so a <ul> keeps the browser's
   * default discs and indent. Anything Preflight would normally have reset has
   * to be asked for explicitly here.
   */
  const gridClasses = [
    'grid list-none gap-x-4 gap-y-8 p-0 m-0',
    MOBILE_COLUMNS[columnsMobile] ?? MOBILE_COLUMNS[2],
    DESKTOP_COLUMNS[columnsDesktop] ?? DESKTOP_COLUMNS[4],
  ].join(' ');

  const trackClasses = [
    'lookbook-track flex list-none gap-x-4 overflow-x-auto p-0 m-0 snap-x snap-mandatory',
    // Room for the focus ring on a card that is scrolled into view by keyboard;
    // without it the ring is clipped by the overflow container.
    'py-1',
  ].join(' ');

  const slideClasses = [
    'flex-none snap-start',
    MOBILE_SLIDES[columnsMobile] ?? MOBILE_SLIDES[2],
    DESKTOP_SLIDES[columnsDesktop] ?? DESKTOP_SLIDES[4],
  ].join(' ');

  const cards = products.map((product, index) => (
    <li key={product.id} className={isSlider ? slideClasses : undefined}>
      <ProductCard
        product={product}
        showVendor={showVendor}
        showPrice={showPrice}
        showCompareAt={showCompareAt}
        rootUrl={rootUrl}
        headingTag={cardHeadingLevel}
        /* The first row is above the fold on desktop — and in a slider, the first
           screenful is the same set of cards, so the rule holds either way. */
        priority={index < columnsDesktop}
      />
    </li>
  ));

  return (
    /*
     * No heading here. Title, description, and cover image are server-known, so
     * Liquid renders them in snippets/lookbook-mount.liquid where they paint with
     * the document rather than waiting on hydration. This component owns only the
     * grid — the part that genuinely has to wait for the Storefront API.
     */
    <section className="lookbook-root font-display" aria-busy={status === 'loading'}>
      {status === 'loading' ? (
        /* The skeleton stays a grid in both layouts. It occupies one screenful
           either way, and a skeleton that scrolls sideways invites a shopper to
           interact with placeholders. */
        <div className={gridClasses}>
          {handles.slice(0, columnsDesktop).map((handle) => (
            <div key={handle} className="animate-pulse">
              <div className="aspect-[3/4] w-full rounded-lookbook bg-lookbook-line" />
              <div className="mt-3 h-3 w-2/3 bg-lookbook-line" />
              <div className="mt-2 h-3 w-1/3 bg-lookbook-line" />
            </div>
          ))}
        </div>
      ) : isSlider ? (
        <Slider
          label={title ? `${title} products` : 'Lookbook products'}
          trackClassName={trackClasses}
        >
          {cards}
        </Slider>
      ) : (
        <ul className={gridClasses}>{cards}</ul>
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
