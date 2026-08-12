import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Horizontal, snap-scrolling track for a lookbook.
 *
 * Scrolling is done by the browser, not by this component. The track is an ordinary
 * overflow container with CSS scroll snapping, so touch, trackpad, shift+wheel and
 * keyboard focus all move it for free, and a card that receives focus is scrolled
 * into view natively. The buttons below only call `scrollBy` on that same container
 * — they are a convenience, never the only way through.
 *
 * That is also why there is no `tabIndex` on the track. A scrollable region normally
 * needs one to satisfy WCAG 2.1.1, but every card here contains a link, so the region
 * is already fully reachable and operable by keyboard; adding one would insert a tab
 * stop that lands on nothing actionable.
 */
export function Slider({ label, trackClassName, children }) {
  const trackRef = useRef(null);

  // Both start false so the controls are absent on the first paint and appear only
  // once measurement proves the track actually overflows. A disabled pair of arrows
  // on a lookbook of three products is noise.
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const sync = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    // `scrollWidth` and `clientWidth` are integers while `scrollLeft` is fractional
    // under browser zoom and on hidpi displays, so an exact comparison leaves the
    // forward button enabled at the end of the track. One pixel of slack absorbs it.
    const furthest = track.scrollWidth - track.clientWidth;
    setCanScrollBack(track.scrollLeft > 1);
    setCanScrollForward(track.scrollLeft < furthest - 1);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    sync();
    track.addEventListener('scroll', sync, { passive: true });

    // Card width and visible column count both change with the viewport, so whether
    // the track overflows is not decided once at mount. A resize observer catches
    // the theme editor resizing the preview frame as well as an actual window resize.
    const observer = new ResizeObserver(sync);
    observer.observe(track);

    return () => {
      track.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, [sync, children]);

  const step = (direction) => {
    const track = trackRef.current;
    if (!track) return;

    // One card per press, measured rather than assumed — the card width is set by
    // the merchant's column settings and the breakpoint, neither of which this
    // component knows. Reading the gap off the computed style keeps the step in
    // sync with the track's own `gap-x-*` utility instead of hardcoding it here.
    const card = track.firstElementChild;
    const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
    const distance = card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;

    track.scrollBy({
      left: distance * direction,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  const hasControls = canScrollBack || canScrollForward;

  return (
    <div className="lookbook-slider">
      {hasControls && (
        <div className="mb-3 flex justify-end gap-2">
          <SliderButton
            label="Previous products"
            disabled={!canScrollBack}
            onClick={() => step(-1)}
            path="M15 18l-6-6 6-6"
          />
          <SliderButton
            label="Next products"
            disabled={!canScrollForward}
            onClick={() => step(1)}
            path="M9 18l6-6-6-6"
          />
        </div>
      )}

      {/*
        `region` gives the track a name in the accessibility tree, so a screen
        reader announces what the horizontal list actually is rather than leaving
        the shopper to infer it from a bare list of links.
      */}
      <ul ref={trackRef} className={trackClassName} role="region" aria-label={label}>
        {children}
      </ul>
    </div>
  );
}

function SliderButton({ label, disabled, onClick, path }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-lookbook-line bg-white text-lookbook-ink transition-opacity hover:border-lookbook-ink disabled:cursor-default disabled:opacity-35 disabled:hover:border-lookbook-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lookbook-ink"
    >
      {/* Decorative: the button's own aria-label already names the action. */}
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={path} />
      </svg>
    </button>
  );
}
