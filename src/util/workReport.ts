import { IBucket } from '~/util/interfaces';

export interface WorkReportHostOption {
  value: string;
  text: string;
  disabled: boolean;
}

// Buckets are grouped by their hostname rather than by parsing bucket ids:
// buckets synced from another device (via aw-sync) keep their original
// hostname but carry a "-synced-from-<device>" suffix in their id, and
// Android watcher buckets don't follow the "aw-watcher-window_<host>" scheme
// at all. Querying the real bucket ids (like buildMultideviceHostParams does
// for the Activity view) keeps synced devices working.
function bucketHost(bucket: IBucket): string {
  return bucket.hostname || (bucket.data && bucket.data.hostname) || 'unknown';
}

function isDesktopWindowBucket(bucket: IBucket): boolean {
  return bucket.type === 'currentwindow' && !bucket.id.startsWith('aw-watcher-android');
}

export interface WorkReportHostBuckets {
  host: string;
  window: string;
  afk: string;
}

function getHostBuckets(buckets: IBucket[]): Map<string, { window?: string; afk?: string }> {
  const byHost = new Map<string, { window?: string; afk?: string }>();
  for (const bucket of buckets) {
    if (bucket.type !== 'currentwindow' && bucket.type !== 'afkstatus') continue;
    const host = bucketHost(bucket);
    const entry = byHost.get(host) || {};
    if (isDesktopWindowBucket(bucket) && !entry.window) entry.window = bucket.id;
    if (bucket.type === 'afkstatus' && !entry.afk) entry.afk = bucket.id;
    byHost.set(host, entry);
  }
  return byHost;
}

export function getWorkReportHostOptions(buckets: IBucket[]): WorkReportHostOption[] {
  const windowHosts = [...new Set(buckets.filter(b => b.type === 'currentwindow').map(bucketHost))];
  const byHost = getHostBuckets(buckets);
  return windowHosts.map(host => {
    const entry = byHost.get(host) || {};
    const supported = !!(entry.window && entry.afk);
    return {
      value: host,
      text: supported ? host : `${host} (requires aw-watcher-afk)`,
      disabled: !supported,
    };
  });
}

/** The window and AFK bucket ids to query for each selected host, in selection order. */
export function getWorkReportHostBuckets(
  selectedHosts: string[],
  buckets: IBucket[]
): WorkReportHostBuckets[] {
  const byHost = getHostBuckets(buckets);
  const result: WorkReportHostBuckets[] = [];
  for (const host of selectedHosts) {
    const entry = byHost.get(host);
    if (entry && entry.window && entry.afk) {
      result.push({ host, window: entry.window, afk: entry.afk });
    }
  }
  return result;
}

export function getUnsupportedWorkReportHosts(
  selectedHosts: string[],
  buckets: IBucket[]
): string[] {
  const supported = new Set(getWorkReportHostBuckets(selectedHosts, buckets).map(h => h.host));
  return selectedHosts.filter(host => !supported.has(host));
}

export function getSupportedWorkReportHosts(selectedHosts: string[], buckets: IBucket[]): string[] {
  return getWorkReportHostBuckets(selectedHosts, buckets).map(h => h.host);
}

// Builds the aw-query string for the Work Time Report. Extracted from the
// component so the generated query can be snapshot-tested — that's how we
// catch arg-count regressions like flood(events, breakTime) which aw-query
// rejects with "Tried to call function flood with invalid amount of arguments".
export function buildWorkReportQuery(
  hosts: WorkReportHostBuckets[],
  categoriesStr: string,
  categoriesFilter: any[]
): string {
  let query = '';
  for (let hi = 0; hi < hosts.length; hi++) {
    const bucketIds = hosts[hi];
    query += `
            events_${hi} = flood(query_bucket(${JSON.stringify(bucketIds.window)}));
            not_afk_${hi} = flood(query_bucket(${JSON.stringify(bucketIds.afk)}));
            not_afk_${hi} = filter_keyvals(not_afk_${hi}, "status", ["not-afk"]);
            events_${hi} = filter_period_intersect(events_${hi}, not_afk_${hi});
            events_${hi} = categorize(events_${hi}, ${categoriesStr});
            events_${hi} = filter_keyvals(events_${hi}, "$category", ${JSON.stringify(
      categoriesFilter
    )});
          `;
  }
  query += '\nevents = [];';
  for (let hi = 0; hi < hosts.length; hi++) {
    query += `\nevents = union_no_overlap(events, events_${hi});`;
  }
  query += `
          duration = sum_durations(events);
          RETURN = {"events": events, "duration": duration};
        `;
  // Strip per-line trailing whitespace so the snapshot test stays stable
  // under the trailing-whitespace pre-commit hook. aw-query is whitespace-
  // tolerant so this has no runtime effect.
  return query
    .split('\n')
    .map(line => line.replace(/\s+$/, ''))
    .join('\n');
}
