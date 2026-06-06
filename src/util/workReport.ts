import { IBucket } from '~/util/interfaces';

export interface WorkReportHostOption {
  value: string;
  text: string;
  disabled: boolean;
}

function getWindowHosts(buckets: IBucket[]): string[] {
  const hosts = buckets
    .filter(bucket => bucket.type === 'currentwindow')
    .map(bucket => bucket.id.replace('aw-watcher-window_', ''));
  return [...new Set(hosts)];
}

function getAFKHosts(buckets: IBucket[]): Set<string> {
  return new Set(
    buckets
      .filter(bucket => bucket.type === 'afkstatus')
      .map(bucket => bucket.id.replace('aw-watcher-afk_', ''))
  );
}

export function getWorkReportHostOptions(buckets: IBucket[]): WorkReportHostOption[] {
  const afkHosts = getAFKHosts(buckets);
  return getWindowHosts(buckets).map(host => {
    const hasAFK = afkHosts.has(host);
    return {
      value: host,
      text: hasAFK ? host : `${host} (requires aw-watcher-afk)`,
      disabled: !hasAFK,
    };
  });
}

export function getUnsupportedWorkReportHosts(
  selectedHosts: string[],
  buckets: IBucket[]
): string[] {
  const afkHosts = getAFKHosts(buckets);
  return selectedHosts.filter(host => !afkHosts.has(host));
}

export function getSupportedWorkReportHosts(selectedHosts: string[], buckets: IBucket[]): string[] {
  const unsupportedHosts = new Set(getUnsupportedWorkReportHosts(selectedHosts, buckets));
  return selectedHosts.filter(host => !unsupportedHosts.has(host));
}

// Builds the aw-query string for the Work Time Report. Extracted from the
// component so the generated query can be snapshot-tested — that's how we
// catch arg-count regressions like flood(events, breakTime) which aw-query
// rejects with "Tried to call function flood with invalid amount of arguments".
export function buildWorkReportQuery(
  hosts: string[],
  categoriesStr: string,
  categoriesFilter: any[]
): string {
  let query = '';
  for (let hi = 0; hi < hosts.length; hi++) {
    const hostname = hosts[hi];
    query += `
            events_${hi} = flood(query_bucket("aw-watcher-window_${hostname}"));
            not_afk_${hi} = flood(query_bucket("aw-watcher-afk_${hostname}"));
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
