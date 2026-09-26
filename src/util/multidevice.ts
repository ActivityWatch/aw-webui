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

// --- Host selection encoded in the Activity route's `:host` param ---------
//
// The Activity view lives at /activity/:host/:periodLength?/:date?, where
// `:host` is one of:
//
//   - a single hostname:            /activity/myhost/day/2026-09-26
//   - a comma-separated host list:  /activity/myhost,phone/day/2026-09-26
//   - the ALL_DEVICES token:        /activity/@all/day/2026-09-26
//
// '@' and ',' never occur in DNS hostnames, so neither the token nor the
// separator can collide with a real single-host URL. Bucket hostnames are
// free-form though (e.g. ScreenTime imports), so:
//  - a param that exactly matches a known hostname is always that single
//    host, so existing single-host URLs keep working whatever they contain;
//  - in a list, each hostname is percent-encoded (on top of the URL's own
//    encoding), so a ',' inside a hostname can't be mistaken for the
//    separator. Plain hostnames ([A-Za-z0-9._-]) are unaffected by this,
//    keeping URLs such as /activity/host1,host2 readable.

/** Reserved `:host` route token meaning "every device with activity data". */
export const ALL_DEVICES = '@all';
export const HOST_SEPARATOR = ',';

export interface HostSelection {
  /** True for the dynamic "all devices" selection (resolved at query time). */
  all: boolean;
  /** Explicitly selected hosts (empty when `all` is true). */
  hosts: string[];
}

/** Parse the Activity route's `:host` param into a host selection. */
export function parseHostParam(param: string, knownHosts: string[] = []): HostSelection {
  if (param === ALL_DEVICES) {
    return { all: true, hosts: [] };
  }
  if (!param) {
    return { all: false, hosts: [] };
  }
  const items = param.includes(HOST_SEPARATOR)
    ? _uniq(
        param
          .split(HOST_SEPARATOR)
          .map(h => _decode(h.trim()))
          .filter(h => h.length > 0)
      )
    : [];
  // A list of known hosts wins over a known host that happens to be spelled
  // the same (hosts "a", "b" and "a,b"); formatHostParam links such a single
  // host in escaped form, so it stays reachable.
  if (items.length > 1 && items.every(h => knownHosts.includes(h))) {
    return { all: false, hosts: items };
  }
  if (knownHosts.includes(param)) {
    return { all: false, hosts: [param] };
  }
  // A single host linked in escaped form (see formatHostParam)
  const decoded = _decode(param);
  if (knownHosts.includes(decoded)) {
    return { all: false, hosts: [decoded] };
  }
  return { all: false, hosts: items.length > 0 ? items : [param] };
}

/**
 * Format a host selection as the `:host` path segment for a route link.
 * The router decodes the segment once before it reaches parseHostParam, so
 * that is the inverse of `parseHostParam(decodeURIComponent(segment))`.
 * Characters such as '/', '?' or '#' are URI-encoded so they can't break
 * the route; list items are encoded once more (see above).
 */
export function formatHostParam(selection: HostSelection | string[]): string {
  const sel = Array.isArray(selection) ? { all: false, hosts: selection } : selection;
  if (sel.all) {
    return ALL_DEVICES;
  }
  if (sel.hosts.length === 1) {
    const host = sel.hosts[0];
    // Escape once more a real host that could be read as the ALL_DEVICES
    // token or as a list (see parseHostParam)
    return host === ALL_DEVICES || host.includes(HOST_SEPARATOR)
      ? encodeURIComponent(encodeURIComponent(host))
      : encodeURIComponent(host);
  }
  return sel.hosts.map(h => encodeURIComponent(encodeURIComponent(h))).join(HOST_SEPARATOR);
}

/** Whether a selection spans more than one device (i.e. needs the multidevice query). */
export function isMultiHostSelection(selection: HostSelection): boolean {
  return selection.all || selection.hosts.length > 1;
}

/**
 * Resolve a selection to the concrete, ordered list of hosts to query.
 *
 * `eligibleHosts` are hosts with usable buckets, in priority order (the
 * multidevice query resolves overlapping events in favour of earlier
 * hosts). "All devices" resolves to every eligible host; an explicit
 * list is intersected with them, keeping the priority order rather than
 * the (arbitrary) order in the URL.
 */
export function resolveHostSelection(selection: HostSelection, eligibleHosts: string[]): string[] {
  if (selection.all) {
    return [...eligibleHosts];
  }
  if (selection.hosts.length <= 1) {
    return [...selection.hosts];
  }
  return eligibleHosts.filter(h => selection.hosts.includes(h));
}

/** Toggle `host` in a selection; returns the new selection (never empty). */
export function toggleHostInSelection(
  selection: HostSelection,
  host: string,
  eligibleHosts: string[]
): HostSelection {
  const current = resolveHostSelection(selection, eligibleHosts);
  const next = current.includes(host) ? current.filter(h => h !== host) : [...current, host];
  if (next.length === 0) {
    // Keep at least one device selected.
    return selection;
  }
  const ordered = eligibleHosts.filter(h => next.includes(h));
  // Hosts that aren't eligible (e.g. a stale host from the URL) are kept at the end.
  next.forEach(h => {
    if (!ordered.includes(h)) ordered.push(h);
  });
  if (ordered.length > 1 && ordered.length === eligibleHosts.length) {
    return { all: true, hosts: [] };
  }
  return { all: false, hosts: ordered };
}

function _decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch (e) {
    // Not valid percent-encoding: take it literally
    return s;
  }
}

function _uniq<T>(arr: T[]): T[] {
  return arr.filter((v, i) => arr.indexOf(v) === i);
}

/**
 * Hosts that can take part in a multidevice query: a window+afk bucket pair
 * (desktop) or an android/ScreenTime bucket (mobile). Fakedata hosts (used
 * for demos/screenshots) are left out unless `includeFakedata` is set.
 * Order is preserved (callers pass bucketsStore.hosts, which is sorted by
 * priority).
 */
export function eligibleMultideviceHosts(
  hosts: string[],
  bucketsWindow: (host: string) => string[],
  bucketsAFK: (host: string) => string[],
  bucketsAndroid: (host: string) => string[],
  { includeFakedata = false }: { includeFakedata?: boolean } = {}
): string[] {
  return hosts.filter(
    host =>
      !!host &&
      host !== 'unknown' &&
      ((bucketsWindow(host).length > 0 && bucketsAFK(host).length > 0) ||
        bucketsAndroid(host).length > 0) &&
      (includeFakedata || !host.startsWith('fakedata'))
  );
}
