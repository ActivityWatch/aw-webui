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

  const hasWindowActivity = (rawWindowDuration ?? 0) > 0;

  // Only flag hostname variants when they could explain missing activity: a
  // view that queries its exact bucket and shows data is healthy, even when
  // a "name.local" sibling bucket exists.
  if (windows.length > 1 && !hasWindowActivity) {
    return {
      kind: 'ambiguous-window',
      host,
      bucketIds: windows.map(bucket => bucket.id),
    };
  }

  if (!windows.some(exactHost)) {
    return { kind: 'missing-window', host };
  }

  const hasAfk = buckets.some(bucket => bucket.type === 'afkstatus' && exactHost(bucket));
  if (!hasAfk) {
    return { kind: 'missing-afk', host };
  }

  if (!hasWindowActivity) {
    return { kind: 'no-window-events', host };
  }

  return null;
}
