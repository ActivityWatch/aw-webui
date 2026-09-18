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
const androidBuckets: { [host: string]: string[] } = {
  phonehost: ['aw-watcher-android-synced-from-phonehost'],
  ioshost: ['aw-import-screentime_ioshost'],
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

  it('skips hosts that lack either a window or an afk bucket (no android fallback given)', () => {
    const { host_params, hosts_with_buckets } = buildMultideviceHostParams(
      ['noafkhost', 'nowindowhost'],
      host => windowBuckets[host] || [],
      host => afkBuckets[host] || []
    );
    expect(hosts_with_buckets).toEqual([]);
    expect(host_params).toEqual({});
  });

  it('falls back to the android bucket for hosts with no afk bucket', () => {
    const { host_params, hosts_with_buckets } = buildMultideviceHostParams(
      ['noafkhost', 'phonehost'],
      host => windowBuckets[host] || [],
      host => afkBuckets[host] || [],
      host => androidBuckets[host] || []
    );
    expect(hosts_with_buckets).toEqual(['phonehost']);
    expect(host_params['phonehost']).toEqual({
      bid_android: 'aw-watcher-android-synced-from-phonehost',
      isIos: false,
    });
    expect(host_params['noafkhost']).toBeUndefined();
  });

  it('marks ScreenTime (iOS) android-bucket hosts with isIos', () => {
    const { host_params, hosts_with_buckets } = buildMultideviceHostParams(
      ['ioshost'],
      host => windowBuckets[host] || [],
      host => afkBuckets[host] || [],
      host => androidBuckets[host] || []
    );
    expect(hosts_with_buckets).toEqual(['ioshost']);
    expect(host_params['ioshost']).toEqual({
      bid_android: 'aw-import-screentime_ioshost',
      isIos: true,
    });
  });

  it('prefers window+afk buckets over an android bucket when both are present', () => {
    const { host_params, hosts_with_buckets } = buildMultideviceHostParams(
      ['myhost'],
      host => windowBuckets[host] || [],
      host => afkBuckets[host] || [],
      () => ['aw-watcher-android-synced-from-myhost']
    );
    expect(hosts_with_buckets).toEqual(['myhost']);
    expect(host_params['myhost']).toEqual({
      bid_window: 'aw-watcher-window_myhost',
      bid_afk: 'aw-watcher-afk_myhost',
    });
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

  it('queries an android-only host without an afk bucket', () => {
    const q = queries
      .multideviceQuery({
        ...baseParams,
        hosts: ['phonehost'],
        host_params: {
          phonehost: { bid_android: 'aw-watcher-android-synced-from-phonehost' },
        },
      })
      .join('\n');
    expect(q).toContain('query_bucket("aw-watcher-android-synced-from-phonehost")');
    // No afkstatus bucket exists for this host, so nothing should reference
    // a reconstructed 'aw-watcher-afk_phonehost' bucket.
    expect(q).not.toContain('aw-watcher-afk_phonehost');
    // The per-host not_afk return variable must still be assigned so the
    // union across hosts doesn't reference an undefined variable.
    expect(q).toContain('not_afk_phonehost = not_afk;');
  });
});
