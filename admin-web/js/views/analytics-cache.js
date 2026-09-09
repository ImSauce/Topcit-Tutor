// ============================================================================
// Walking every student's subcollections is the most expensive read in the
// portal, so the result is cached in memory and shared by Progress Monitoring
// and Reports & Analytics. Press "Refresh" in either view to recompute.
// ============================================================================

import { computeAnalytics } from "../store.js";

let cache = null;
let inflight = null;

export function cached() {
  return cache;
}

export async function getAnalytics({ force = false, onProgress = () => {} } = {}) {
  if (cache && !force) return cache;
  if (inflight && !force) return inflight;
  inflight = computeAnalytics(onProgress)
    .then((result) => { cache = result; return result; })
    .finally(() => { inflight = null; });
  return inflight;
}

export function clearAnalytics() {
  cache = null;
}
