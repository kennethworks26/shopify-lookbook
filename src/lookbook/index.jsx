import { createRoot } from 'react-dom/client';
import { Lookbook } from './Lookbook.jsx';
import './styles.css';

/**
 * Entry point for the lookbook island.
 *
 * Liquid decides *which* lookbooks appear and emits a mount node for each, carrying
 * its configuration in a `data-lookbook` attribute. This file finds those nodes and
 * hydrates each one independently — a page can hold several lookbooks (two on a
 * product page, per the max-2 rule) and one failing must not take the others down.
 *
 * See docs/spec.md §5.1 for why the Liquid/React split falls here.
 */

const MOUNT_SELECTOR = '[data-lookbook]';

/**
 * Read and validate a mount node's configuration.
 *
 * The payload is JSON written by Liquid. It is same-origin and server-authored, but
 * it is still parsed defensively: a malformed metaobject should disable one section,
 * not throw during module evaluation and leave every other island unmounted.
 *
 * @param {HTMLElement} node
 * @returns {object|null} parsed config, or null if unusable
 */
export function readConfig(node) {
  const raw = node.getAttribute('data-lookbook');
  if (!raw) return null;

  let config;
  try {
    config = JSON.parse(raw);
  } catch {
    console.error('[lookbook] Could not parse section configuration.', node);
    return null;
  }

  if (!Array.isArray(config.handles) || config.handles.length === 0) {
    return null;
  }

  return config;
}

function mountAll() {
  const nodes = document.querySelectorAll(MOUNT_SELECTOR);

  nodes.forEach((node) => {
    if (node.dataset.lookbookMounted === 'true') return;

    const config = readConfig(node);
    if (!config) return;

    node.dataset.lookbookMounted = 'true';
    createRoot(node).render(<Lookbook {...config} />);
  });
}

// The theme editor re-renders sections without a full page load, so a one-shot mount
// on DOMContentLoaded would leave a re-rendered section blank until the merchant
// refreshes. Shopify fires these events on the document for exactly this case.
document.addEventListener('shopify:section:load', mountAll);
document.addEventListener('DOMContentLoaded', mountAll);

// The script is deferred, so DOMContentLoaded may already have fired by the time
// this module evaluates.
if (document.readyState !== 'loading') mountAll();
