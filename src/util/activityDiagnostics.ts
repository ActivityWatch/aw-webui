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
  queryComplete: boolean;
  windowDuration: number | null;
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
  queryComplete,
  windowDuration,
}: ActivityDiagnosticInput): ActivityDiagnostic | null {
  if (isMultidevice || !queryComplete) return null;

  const exactHost = (bucket: DiagnosticBucket) => bucketHost(bucket) === host;
  const sameDevice = (bucket: DiagnosticBucket) =>
    canonicalHostname(bucketHost(bucket)) === canonicalHostname(host);
  const windows = buckets.filter(bucket => bucket.type === 'currentwindow' && sameDevice(bucket));

  if (windows.length > 1) {
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

  if (windowDuration === 0) {
    return { kind: 'no-window-events', host };
  }

  return null;
}
