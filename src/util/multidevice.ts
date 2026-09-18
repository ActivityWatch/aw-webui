// Pure helpers for building the per-host bucket-ID overrides used by the
// multidevice query.  Kept free of store imports so they can be unit-tested
// in isolation.

type HostParamOverride =
  | { bid_window: string; bid_afk: string }
  | { bid_android: string; isIos?: boolean };

export interface MultideviceHostSelection {
  /** Per-host bucket-ID overrides, keyed by hostname. */
  host_params: { [host: string]: HostParamOverride };
  /** The subset of `hosts` that had usable buckets (window+afk, or android/ScreenTime). */
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
 * Hosts with both a window and an afk bucket use the desktop query path.
 * Hosts with only an android/ScreenTime bucket (mobile devices synced via
 * aw-sync never have an afkstatus bucket) fall back to the android query
 * path, which has no afk filter — matching the single-device Android view.
 * Hosts with neither are skipped (with a warning).
 */
export function buildMultideviceHostParams(
  hosts: string[],
  bucketsWindow: (host: string) => string[],
  bucketsAFK: (host: string) => string[],
  bucketsAndroid?: (host: string) => string[]
): MultideviceHostSelection {
  const host_params: MultideviceHostSelection['host_params'] = {};
  const hosts_with_buckets: string[] = [];
  hosts.forEach(host => {
    const bid_window = bucketsWindow(host)[0];
    const bid_afk = bucketsAFK(host)[0];
    if (bid_window && bid_afk) {
      host_params[host] = { bid_window, bid_afk };
      hosts_with_buckets.push(host);
      return;
    }
    const androidBucketIds = bucketsAndroid ? bucketsAndroid(host) : [];
    // Prefer the ScreenTime bucket when a host has both an Android watcher
    // and a ScreenTime bucket, matching the single-device Android view
    // (see query_android in stores/activity.ts): otherwise index 0 would
    // pick the Android watcher bucket, set isIos to false, and the host's
    // ScreenTime data would never be processed.
    const bid_android =
      androidBucketIds.find(id => id.startsWith('aw-import-screentime')) || androidBucketIds[0];
    if (bid_android) {
      host_params[host] = { bid_android, isIos: bid_android.startsWith('aw-import-screentime') };
      hosts_with_buckets.push(host);
      return;
    }
    console.warn(`Skipping host ${host} in multidevice query: missing window/afk bucket`);
  });
  return { host_params, hosts_with_buckets };
}
