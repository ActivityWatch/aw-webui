// Pure helpers for building the per-host bucket-ID overrides used by the
// multidevice query.  Kept free of store imports so they can be unit-tested
// in isolation.

export interface MultideviceHostSelection {
  /** Per-host bucket-ID overrides, keyed by hostname. */
  host_params: { [host: string]: { bid_window: string; bid_afk: string } };
  /** The subset of `hosts` that had both a window and an afk bucket. */
  hosts_with_buckets: string[];
}

/**
 * Build per-host bucket-ID overrides for the multidevice query from the
 * actual buckets available for each host.
 *
 * This is needed because buckets synced from another host (via aw-sync)
 * keep their original hostname but carry an "-synced-from-<host>" suffix in
 * their bucket ID, so the reconstructed "aw-watcher-window_<hostname>" IDs
 * do not exist in the local datastore.
 *
 * Hosts lacking either a window or an afk bucket are skipped (with a
 * warning), since canonicalEvents requires the pair.
 */
export function buildMultideviceHostParams(
  hosts: string[],
  bucketsWindow: (host: string) => string[],
  bucketsAFK: (host: string) => string[]
): MultideviceHostSelection {
  const host_params: MultideviceHostSelection['host_params'] = {};
  const hosts_with_buckets: string[] = [];
  hosts.forEach(host => {
    const bid_window = bucketsWindow(host)[0];
    const bid_afk = bucketsAFK(host)[0];
    if (bid_window && bid_afk) {
      host_params[host] = { bid_window, bid_afk };
      hosts_with_buckets.push(host);
    } else {
      console.warn(`Skipping host ${host} in multidevice query: missing window/afk bucket`);
    }
  });
  return { host_params, hosts_with_buckets };
}
