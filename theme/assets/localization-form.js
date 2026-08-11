/**
 * Submit the market selector when its value changes.
 *
 * Changing market is a full page load, and deliberately so. The market is
 * server-side context: it drives `@inContext` for the lookbook island, but it
 * also drives Liquid's `money` filters on the product page, the cart totals,
 * which products a market's catalog includes, and shipping. Swapping currency
 * on the client would update the lookbook grid and leave every server-rendered
 * price on the page disagreeing with it. One source of truth, one reload.
 *
 * This is Shopify's own pattern: POST to /localization, which sets a cookie and
 * redirects back to `return_to`.
 *
 * Kept out of an inline `onchange` attribute so the theme carries no inline
 * handlers — those are the first thing a Content Security Policy blocks, and a
 * market selector that silently stops working under CSP is a bad way to find out.
 *
 * Not bundled: plain ES5-compatible DOM code, served exactly as committed.
 * See docs/adr/0001-react-island-build-step.md.
 */
(function () {
  var SELECTOR = '[data-localization-form]';

  function bind(form) {
    if (form.dataset.localizationBound === 'true') return;
    form.dataset.localizationBound = 'true';

    var select = form.querySelector('select');
    if (!select) return;

    select.addEventListener('change', function () {
      form.submit();
    });
  }

  function bindAll() {
    document.querySelectorAll(SELECTOR).forEach(bind);
  }

  // The theme editor re-renders sections without a full page load, so a one-shot
  // binding would leave a re-rendered header inert until the merchant refreshed.
  document.addEventListener('shopify:section:load', bindAll);
  document.addEventListener('DOMContentLoaded', bindAll);

  // The script is deferred, so DOMContentLoaded may already have fired.
  if (document.readyState !== 'loading') bindAll();
})();
