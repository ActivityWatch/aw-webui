import { buildMultideviceHostParams } from '~/util/multidevice';
import queries from '~/queries';

// Simulated bucket inventories, mirroring how aw-sync stores pulled data:
// bucket IDs carry an "-synced-from-<host>" suffix while the hostname
// (which the store groups by) stays the original.
const windowBuckets: { [host: string]: string[] } = {
  myhost: ['aw-watcher-window_myhost'],
  otherhost: ['aw-watcher-window_otherhost-synced-from-otherhost'],
  noafkhost: ['aw-watcher-window_noafkhost'],
  nowindowhost: [],
};
const afkBuckets: { [host: string]: string[] } = {
  myhost: ['aw-watcher-afk_myhost'],
  otherhost: ['aw-watcher-afk_otherhost-synced-from-otherhost'],
  noafkhost: [],
  nowindowhost: ['aw-watcher-afk_nowindowhost'],
};

describe('buildMultideviceHostParams', () => {
  it('uses the actual bucket IDs for each host', () => {
    const { host_params, hosts_with_buckets } = buildMultideviceHostParams(
      ['myhost', 'otherhost'],
      host => windowBuckets[host] || [],
      host => afkBuckets[host] || []
    );
    expect(hosts_with_buckets).toEqual(['myhost', 'otherhost']);
    expect(host_params['myhost']).toEqual({
      bid_window: 'aw-watcher-window_myhost',
      bid_afk: 'aw-watcher-afk_myhost',
    });
    expect(host_params['otherhost']).toEqual({
      bid_window: 'aw-watcher-window_otherhost-synced-from-otherhost',
      bid_afk: 'aw-watcher-afk_otherhost-synced-from-otherhost',
    });
  });

  it('skips hosts that lack either a window or an afk bucket', () => {
    const { host_params, hosts_with_buckets } = buildMultideviceHostParams(
      ['noafkhost', 'nowindowhost'],
      host => windowBuckets[host] || [],
      host => afkBuckets[host] || []
    );
    expect(hosts_with_buckets).toEqual([]);
    expect(host_params).toEqual({});
  });
});

describe('multideviceQuery with host_params overrides', () => {
  const baseParams = {
    filter_afk: true,
    categories: [],
    filter_categories: [],
    always_active_pattern: '',
  };

  it('queries hosts by their actual (synced) bucket IDs', () => {
    const q = queries
      .multideviceQuery({
        ...baseParams,
        hosts: ['otherhost'],
        host_params: {
          otherhost: {
            bid_window: 'aw-watcher-window_otherhost-synced-from-otherhost',
            bid_afk: 'aw-watcher-afk_otherhost-synced-from-otherhost',
          },
        },
      })
      .join('\n');
    expect(q).toContain('query_bucket("aw-watcher-window_otherhost-synced-from-otherhost")');
    expect(q).toContain('query_bucket("aw-watcher-afk_otherhost-synced-from-otherhost")');
    // The reconstructed ID (without the -synced-from- suffix) must not be
    // queried — it does not exist in the local datastore and would fail
    // with BucketNotFound.
    expect(q).not.toContain('query_bucket("aw-watcher-window_otherhost")');
    expect(q).not.toContain('query_bucket("aw-watcher-afk_otherhost")');
  });

  it('falls back to reconstructed IDs when no override is given', () => {
    const q = queries
      .multideviceQuery({
        ...baseParams,
        hosts: ['myhost'],
        host_params: {},
      })
      .join('\n');
    expect(q).toContain('query_bucket("aw-watcher-window_myhost")');
    expect(q).toContain('query_bucket("aw-watcher-afk_myhost")');
  });
});
