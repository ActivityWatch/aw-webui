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
