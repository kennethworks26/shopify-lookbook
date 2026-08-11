/**
 * Restore merchandiser ordering to Storefront API results.
 *
 * `products(query: "handle:a OR handle:b")` gives no ordering guarantee — the API is
 * free to return matches in whatever order its index produces, and that order is not
 * stable across calls. A lookbook is a curated sequence, so the order the
 * merchandiser typed into `product_handles` is the whole point and has to be
 * reimposed here.
 */

/**
 * Order products to match a list of handles, dropping anything that did not resolve.
 *
 * Unresolved handles are silently dropped rather than rendered as a gap. A handle
 * stops resolving when a product is unpublished, deleted, or renamed — all normal
 * merchandising events. The shopper should see a shorter lookbook, not a broken tile.
 * The theme editor surfaces the dead handles so the merchant can fix them; see
 * docs/spec.md §5.6.
 *
 * @param {Array<{handle: string}>} products  results from the Storefront API
 * @param {string[]} handles                  handles in merchandiser order
 * @returns {Array<{handle: string}>}
 */
export function sortByHandleOrder(products, handles) {
  if (!Array.isArray(products) || !Array.isArray(handles)) return [];

  const byHandle = new Map(products.map((product) => [product.handle, product]));

  return handles.map((handle) => byHandle.get(handle)).filter(Boolean);
}

/**
 * Handles that were asked for but did not come back.
 *
 * Merchant-facing diagnostics only — never rendered to shoppers.
 *
 * @param {Array<{handle: string}>} products
 * @param {string[]} handles
 * @returns {string[]}
 */
export function missingHandles(products, handles) {
  if (!Array.isArray(handles)) return [];

  const found = new Set((products ?? []).map((product) => product.handle));

  return handles.filter((handle) => !found.has(handle));
}
