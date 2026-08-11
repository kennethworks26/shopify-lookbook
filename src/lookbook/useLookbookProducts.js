import { useEffect, useState } from 'react';
import { fetchLookbookProducts } from './api/storefront.js';
import { missingHandles } from './lib/sort.js';

/**
 * Load a lookbook's products from the Storefront API.
 *
 * @param {object} config  the payload Liquid wrote into `data-lookbook`
 * @returns {{status: 'loading'|'ready'|'error', products: object[], missing: string[], error: Error|null}}
 */
export function useLookbookProducts(config) {
  const { handles, shop, token, apiVersion, country, language } = config;

  const [state, setState] = useState({
    status: 'loading',
    products: [],
    missing: [],
    error: null,
  });

  // `handles` arrives as a fresh array on every render because it is parsed from a
  // data attribute, so it cannot be a dependency directly — it would refetch forever.
  // The joined string is the value that actually matters.
  const handleKey = handles.join(',');

  useEffect(() => {
    // Guard here rather than at the call site: a missing token is a merchant
    // configuration error, and it should surface as this component's error state
    // (which the theme editor renders as guidance) rather than as a failed request.
    if (!token) {
      setState({
        status: 'error',
        products: [],
        missing: [],
        error: new Error('No Storefront API token configured in theme settings.'),
      });
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    setState((previous) => ({ ...previous, status: 'loading' }));

    fetchLookbookProducts({
      handles,
      domain: shop,
      token,
      apiVersion,
      country,
      language,
      signal: controller.signal,
    })
      .then((products) => {
        if (!active) return;
        setState({
          status: 'ready',
          products,
          missing: missingHandles(products, handles),
          error: null,
        });
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return;
        setState({ status: 'error', products: [], missing: [], error });
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleKey, shop, token, apiVersion, country, language]);

  return state;
}
