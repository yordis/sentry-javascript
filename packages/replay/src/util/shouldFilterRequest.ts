import { getCurrentHub } from '@sentry/core';

import type { ReplayContainer } from '../types';

/**
 * Check whether a given request URL should be filtered out.
 */
export function shouldFilterRequest(replay: ReplayContainer, url: string): boolean {
  // If we enabled the `traceInternals` experiment, we want to trace everything
  if (__DEBUG_BUILD__ && replay.getOptions()._experiments?.traceInternals) {
    return false;
  }

  return !_isSentryRequest(url);
}

/**
 * Checks wether a given URL belongs to the configured Sentry DSN.
 */
function _isSentryRequest(url: string): boolean {
  const dsn = getCurrentHub().getClient()?.getDsn();
  return dsn ? url.includes(dsn.host) : false;
}