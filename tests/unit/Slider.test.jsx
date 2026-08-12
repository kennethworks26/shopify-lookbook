/**
 * The slider's whole job is to translate an overflowing box into two buttons that
 * are enabled at the right moments. jsdom performs no layout, so every dimension
 * here is stubbed explicitly — which is fine, because what is being tested is the
 * arithmetic on those dimensions and not the browser's ability to lay out a row.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { Slider } from '../../src/lookbook/Slider.jsx';

/** Give a node the layout jsdom will not compute. */
function setMetrics(node, { scrollWidth, clientWidth, scrollLeft = 0 }) {
  Object.defineProperty(node, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(node, 'clientWidth', { value: clientWidth, configurable: true });
  Object.defineProperty(node, 'scrollLeft', {
    value: scrollLeft,
    writable: true,
    configurable: true,
  });
}

function renderSlider(metrics, { reducedMotion = false } = {}) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: reducedMotion && query.includes('reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

  const view = render(
    <Slider label="Autumn Layers products" trackClassName="track">
      <li>
        <a href="/products/a">A</a>
      </li>
      <li>
        <a href="/products/b">B</a>
      </li>
    </Slider>
  );

  const track = screen.getByRole('region', { name: 'Autumn Layers products' });
  setMetrics(track, metrics);

  // The first card is what a single press scrolls by, so it needs a width.
  Object.defineProperty(track.firstElementChild, 'getBoundingClientRect', {
    value: () => ({ width: 200 }),
    configurable: true,
  });

  track.scrollBy = vi.fn();

  // Measurement happens on mount and on scroll. Mount already ran against the
  // unstubbed node, so a scroll event is what re-reads the values set above.
  // `act` is required because the resulting setState happens outside React's own
  // event handling — without it the buttons are queried before the re-render.
  act(() => {
    track.dispatchEvent(new Event('scroll'));
  });

  return { ...view, track };
}

beforeEach(() => {
  // jsdom ships no ResizeObserver, and the component observes the track.
  global.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Slider', () => {
  it('renders its cards inside a named region', () => {
    renderSlider({ scrollWidth: 800, clientWidth: 400 });

    const track = screen.getByRole('region', { name: 'Autumn Layers products' });
    expect(track.tagName).toBe('UL');
    expect(track).toHaveClass('track');
    expect(screen.getByRole('link', { name: 'A' })).toBeInTheDocument();
  });

  it('shows no controls when the track does not overflow', () => {
    // A lookbook of three products in a four-column slider fits, so arrows would
    // be permanently dead controls.
    renderSlider({ scrollWidth: 400, clientWidth: 400 });

    expect(screen.queryByRole('button', { name: 'Next products' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous products' })).not.toBeInTheDocument();
  });

  it('disables the back button at the start of the track', () => {
    renderSlider({ scrollWidth: 800, clientWidth: 400, scrollLeft: 0 });

    expect(screen.getByRole('button', { name: 'Previous products' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next products' })).toBeEnabled();
  });

  it('disables the forward button at the end of the track', () => {
    renderSlider({ scrollWidth: 800, clientWidth: 400, scrollLeft: 400 });

    expect(screen.getByRole('button', { name: 'Next products' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous products' })).toBeEnabled();
  });

  it('treats a sub-pixel gap at the end as the end', () => {
    // scrollLeft is fractional under zoom while scrollWidth and clientWidth are
    // rounded, so an exact comparison leaves the forward arrow live at the end.
    renderSlider({ scrollWidth: 800, clientWidth: 400, scrollLeft: 399.4 });

    expect(screen.getByRole('button', { name: 'Next products' })).toBeDisabled();
  });

  it('scrolls forward by one card plus the gap', () => {
    const { track } = renderSlider({ scrollWidth: 800, clientWidth: 400 });

    fireEvent.click(screen.getByRole('button', { name: 'Next products' }));

    // 200px card, and jsdom reports no column-gap, so the step is the card alone.
    expect(track.scrollBy).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' });
  });

  it('scrolls backward by a negative step', () => {
    const { track } = renderSlider({ scrollWidth: 800, clientWidth: 400, scrollLeft: 400 });

    fireEvent.click(screen.getByRole('button', { name: 'Previous products' }));

    expect(track.scrollBy).toHaveBeenCalledWith({ left: -200, behavior: 'smooth' });
  });

  it('jumps instead of animating when reduced motion is preferred', () => {
    const { track } = renderSlider({ scrollWidth: 800, clientWidth: 400 }, { reducedMotion: true });

    fireEvent.click(screen.getByRole('button', { name: 'Next products' }));

    expect(track.scrollBy).toHaveBeenCalledWith({ left: 200, behavior: 'auto' });
  });
});
