type DiagnosticBucket = {
  id: string;
  hostname?: string;
  type: string;
  data?: { hostname?: string };
};

export type ActivityDiagnostic =
  | { kind: 'missing-window'; host: string }
  | { kind: 'missing-afk'; host: string }
  | { kind: 'ambiguous-window'; host: string; bucketIds: string[] }
  | { kind: 'mismatched-hostnames'; host: string; windowHosts: string[]; afkHosts: string[] }
  | { kind: 'no-window-events'; host: string };

type ActivityDiagnosticInput = {
  host: string;
  buckets: DiagnosticBucket[];
  isMultidevice: boolean;
  isMobile: boolean;
  queryComplete: boolean;
  // Window-bucket activity before the AFK/category filters. Unlike the
  // filtered active time, this is non-zero whenever the bucket holds events
  // for the period, so it is the signal for "the view is genuinely empty".
  rawWindowDuration: number | null;
};

function bucketHost(bucket: DiagnosticBucket): string {
  return bucket.hostname || bucket.data?.hostname || '';
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

// macOS commonly changes a hostname between "name" and "name.local".
// Treat those as variants when looking for duplicate window buckets, while
// keeping the actual Activity query's exact-host matching unchanged.
function canonicalHostname(host: string): string {
  return host
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/\.local$/, '');
}

export function activityDiagnostic({
  host,
  buckets,
  isMultidevice,
  isMobile,
  queryComplete,
  rawWindowDuration,
}: ActivityDiagnosticInput): ActivityDiagnostic | null {
  // The single-device Android and iOS ScreenTime views have no afkstatus or
  // currentwindow bucket by design (mobile watchers never produce them), so
  // the desktop checks below would otherwise tell mobile users to start
  // watchers they cannot run.
  if (isMultidevice || isMobile || !queryComplete) return null;

  const exactHost = (bucket: DiagnosticBucket) => bucketHost(bucket) === host;
  const sameDevice = (bucket: DiagnosticBucket) =>
    canonicalHostname(bucketHost(bucket)) === canonicalHostname(host);
  const windows = buckets.filter(bucket => bucket.type === 'currentwindow' && sameDevice(bucket));

  const hasExactWindow = windows.some(exactHost);
  const hasWindowActivity = (rawWindowDuration ?? 0) > 0;

  // No window bucket for this device at all: the watcher is not reporting.
  if (windows.length === 0) {
    return { kind: 'missing-window', host };
  }

  const hasAfk = buckets.some(bucket => bucket.type === 'afkstatus' && exactHost(bucket));
  const afks = buckets.filter(bucket => bucket.type === 'afkstatus' && sameDevice(bucket));
  const afkHosts = unique(afks.map(bucketHost));
  // Window buckets under another hostname variant ("laptop.local" vs
  // "laptop") that also has an AFK bucket: selecting that variant would
  // give the query a complete pair.
  const pairedWindows = windows.filter(
    bucket => !exactHost(bucket) && afkHosts.includes(bucketHost(bucket))
  );

  // The desktop query needs a window AND an afkstatus bucket under the exact
  // selected hostname (`set_available`). When that pair is missing, only
  // suggest a remedy that would actually produce one.
  if (!hasExactWindow || !hasAfk) {
    const windowHosts = unique(windows.map(bucketHost));

    if (pairedWindows.length > 0) {
      return {
        kind: 'ambiguous-window',
        host,
        bucketIds: pairedWindows.map(bucket => bucket.id),
      };
    }

    // No AFK watcher for this device at all. Name the hostname the window
    // watcher reports under, since that is where the AFK bucket must appear.
    if (afks.length === 0) {
      return { kind: 'missing-afk', host: hasExactWindow ? host : windowHosts.join(', ') };
    }

    // Both watchers run, but never under the same hostname, so no device
    // selection can show activity.
    return { kind: 'mismatched-hostnames', host, windowHosts, afkHosts };
  }

  // Only flag hostname variants when they could explain missing activity: a
  // view that queries its exact bucket and shows data is healthy, even when
  // a "name.local" sibling bucket exists. A variant without its own AFK
  // bucket would be just as blank, so it is not worth pointing at.
  if (pairedWindows.length > 0 && !hasWindowActivity) {
    return {
      kind: 'ambiguous-window',
      host,
      bucketIds: windows
        .filter(bucket => exactHost(bucket) || pairedWindows.includes(bucket))
        .map(bucket => bucket.id),
    };
  }

  if (!hasWindowActivity) {
    return { kind: 'no-window-events', host };
  }

  return null;
}
