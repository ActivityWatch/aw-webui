import { setActivePinia, createPinia } from 'pinia';

import { useActivityStore } from '~/stores/activity';
import { selectPeriodsToQuery } from '~/util/activeHistory';
import { useBucketsStore } from '~/stores/buckets';
import { createClient, getClient } from '~/util/awclient';

const bucket = (id: string, type: string, hostname: string) => ({
  id,
  type,
  hostname,
  client: 'test',
  created: '2026-01-01T00:00:00Z',
  last_updated: '2026-01-01T00:00:00Z',
  data: {},
});

describe('activity store host selection', () => {
  setActivePinia(createPinia());
  createClient();

  const activityStore = useActivityStore();
  const bucketsStore = useBucketsStore();
  bucketsStore.buckets = [
    bucket('aw-watcher-window_self', 'currentwindow', 'self'),
    bucket('aw-watcher-afk_self', 'afkstatus', 'self'),
    bucket('aw-watcher-window_laptop-synced-from-laptop', 'currentwindow', 'laptop'),
    bucket('aw-watcher-afk_laptop-synced-from-laptop', 'afkstatus', 'laptop'),
    bucket('aw-watcher-android-test-synced-from-phone', 'currentwindow', 'phone'),
    bucket('aw-watcher-window_fakedata', 'currentwindow', 'fakedata'),
    bucket('aw-watcher-afk_fakedata', 'afkstatus', 'fakedata'),
  ] as any;

  test('a single host is not a multidevice selection', () => {
    expect(activityStore.resolve_multidevice_hosts('self')).toEqual([]);
  });

  test('@all resolves to every real host with data, including synced and mobile ones', () => {
    const hosts = activityStore.resolve_multidevice_hosts('@all');
    expect(hosts.sort()).toEqual(['laptop', 'phone', 'self']);
  });

  test('an explicit list is resolved against the available hosts', () => {
    expect(activityStore.resolve_multidevice_hosts('phone,nonexistent,laptop').sort()).toEqual([
      'laptop',
      'phone',
    ]);
  });

  test('fakedata hosts are only included when explicitly selected', () => {
    expect(activityStore.resolve_multidevice_hosts('fakedata,self').sort()).toEqual([
      'fakedata',
      'self',
    ]);
  });

  test('multidevice params use the actual (synced) bucket ids', () => {
    const params = activityStore.multidevice_params(
      { host: '@all', filter_afk: true, filter_categories: [], always_active_pattern: '' },
      ['laptop', 'phone']
    );
    expect(params.hosts).toEqual(['laptop', 'phone']);
    expect(params.host_params.laptop).toEqual({
      bid_window: 'aw-watcher-window_laptop-synced-from-laptop',
      bid_afk: 'aw-watcher-afk_laptop-synced-from-laptop',
    });
    expect(params.host_params.phone).toEqual({
      bid_android: 'aw-watcher-android-test-synced-from-phone',
      isIos: false,
    });
  });
});

describe('multidevice availability flags', () => {
  setActivePinia(createPinia());
  const activityStore = useActivityStore();
  const bucketsStore = useBucketsStore();

  async function flagsFor(hosts: string[]) {
    // Only the flags matter here: skip the actual queries
    for (const name of [
      'query_multidevice_full',
      'query_active_history_multidevice',
      'query_editor',
      'query_editor_completed',
      'query_category_time_by_period',
    ]) {
      jest.spyOn(activityStore, name as any).mockResolvedValue(undefined);
    }
    await activityStore.ensure_loaded_multidevice(
      {
        host: '@all',
        timeperiod: { start: '2026-09-25T04:00:00+02:00', length: [1, 'day'] },
      } as any,
      hosts
    );
    return {
      window: activityStore.window.available,
      android: activityStore.android.available,
    };
  }

  test('titles are available when a desktop host is selected', async () => {
    bucketsStore.buckets = [
      bucket('aw-watcher-window_self', 'currentwindow', 'self'),
      bucket('aw-watcher-afk_self', 'afkstatus', 'self'),
      bucket('aw-watcher-android-test', 'currentwindow', 'phone'),
    ] as any;
    expect(await flagsFor(['self', 'phone'])).toEqual({ window: true, android: false });
  });

  test('mobile-only selections behave like the Android view (no titles)', async () => {
    bucketsStore.buckets = [
      bucket('aw-watcher-android-test', 'currentwindow', 'phone'),
      bucket('aw-watcher-android-test-synced-from-tablet', 'currentwindow', 'tablet'),
    ] as any;
    expect(await flagsFor(['phone', 'tablet'])).toEqual({ window: false, android: true });
  });
});

describe('selectPeriodsToQuery', () => {
  const now = new Date('2026-09-15T12:00:00Z');
  const aug = '2026-08-01T00:00:00Z/2026-09-01T00:00:00Z';
  const sep = '2026-09-01T00:00:00Z/2026-10-01T00:00:00Z';
  const oct = '2026-10-01T00:00:00Z/2026-11-01T00:00:00Z';

  test('reuses cached past periods (keys, not values)', () => {
    expect(selectPeriodsToQuery([aug], { [aug]: [] }, now)).toEqual([]);
    expect(selectPeriodsToQuery([aug], {}, now)).toEqual([aug]);
  });

  test('re-queries the period containing now, and skips future ones', () => {
    expect(selectPeriodsToQuery([aug, sep, oct], { [aug]: [], [sep]: [] }, now)).toEqual([sep]);
  });
});

describe('multidevice path for custom ranges and All time', () => {
  setActivePinia(createPinia());
  const activityStore = useActivityStore();
  const bucketsStore = useBucketsStore();
  bucketsStore.buckets = [
    bucket('aw-watcher-window_self', 'currentwindow', 'self'),
    bucket('aw-watcher-afk_self', 'afkstatus', 'self'),
    bucket('aw-watcher-android-test', 'currentwindow', 'phone'),
  ] as any;

  afterEach(() => jest.restoreAllMocks());

  function spies() {
    const names = [
      'query_multidevice_full',
      'query_active_history_multidevice',
      'query_editor',
      'query_editor_completed',
      'query_category_time_by_period',
    ];
    return Object.fromEntries(
      names.map(n => [n, jest.spyOn(activityStore, n as any).mockResolvedValue(undefined)])
    );
  }

  test('skips period-usage history when asked', async () => {
    const s = spies();
    await activityStore.ensure_loaded_multidevice(
      {
        host: '@all',
        skip_active_history: true,
        timeperiod: { start: '2026-09-01T04:00:00+02:00', length: [7, 'days'] },
      } as any,
      ['self', 'phone']
    );
    expect(s.query_active_history_multidevice).not.toHaveBeenCalled();
    expect(s.query_category_time_by_period).toHaveBeenCalled();
  });

  test('an exact interval keeps the category chart and its exact timeperiod', async () => {
    const s = spies();
    const timeperiod = { start: '2026-10-20T13:00:00Z', length: [3600000, 'milliseconds'] };
    await activityStore.ensure_loaded_multidevice(
      { host: '@all', skip_active_history: true, timeperiod } as any,
      ['self', 'phone']
    );
    expect(s.query_active_history_multidevice).not.toHaveBeenCalled();
    expect(s.query_category_time_by_period).toHaveBeenCalledWith(
      expect.objectContaining({ timeperiod })
    );
    expect(s.query_multidevice_full).toHaveBeenCalled();
  });

  test('long ranges take the barchart from the query chunks instead', async () => {
    const s = spies();
    await activityStore.ensure_loaded_multidevice(
      {
        host: '@all',
        timeperiod: { start: '2024-01-01T04:00:00+01:00', length: [700, 'days'] },
      } as any,
      ['self', 'phone']
    );
    expect(s.query_active_history_multidevice).toHaveBeenCalled();
    expect(s.query_category_time_by_period).not.toHaveBeenCalled();
  });
});

describe('per-device duration loading lifecycle', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test('clears the previous breakdown immediately when a new selection starts loading', () => {
    const store = useActivityStore();
    store.query_window_completed({
      app_events: [],
      title_events: [],
      duration: 15,
      host_durations: [
        { host: 'desktop', duration: 10, overlap: 0 },
        { host: 'phone', duration: 5, overlap: 3 },
      ],
    });
    expect(store.window.host_durations).toHaveLength(2);

    store.start_loading({ host: 'desktop,tablet' } as any);

    expect(store.active.duration).toBeNull();
    expect(store.window.host_durations).toEqual([]);

    // Only a completed query may populate the replacement devices/durations.
    store.query_window_completed({
      app_events: [],
      title_events: [],
      duration: 7,
      host_durations: [
        { host: 'desktop', duration: 4, overlap: 0 },
        { host: 'tablet', duration: 3, overlap: 0 },
      ],
    });
    expect(store.window.host_durations.map(row => row.host)).toEqual(['desktop', 'tablet']);
    expect(store.active.duration).toBe(7);
  });
});

describe('multidevice browser buckets and completion', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  afterEach(() => jest.restoreAllMocks());

  test('attributes host-scoped browser buckets per device and ignores unknown-host buckets', () => {
    const activityStore = useActivityStore();
    const bucketsStore = useBucketsStore();
    bucketsStore.buckets = [
      bucket('aw-watcher-window_laptop', 'currentwindow', 'laptop'),
      bucket('aw-watcher-afk_laptop', 'afkstatus', 'laptop'),
      bucket('aw-watcher-web-firefox_laptop', 'web.tab.current', 'laptop'),
      bucket('aw-watcher-android-synced-from-phone', 'currentwindow', 'phone'),
      bucket('aw-watcher-android-web-synced-from-phone', 'web.tab.current', 'phone'),
      bucket('aw-watcher-web-chrome', 'web.tab.current', 'unknown'),
    ] as any;

    activityStore.get_buckets_multidevice(['laptop', 'phone']);
    expect(activityStore.buckets.browser).toEqual([
      'aw-watcher-web-firefox_laptop',
      'aw-watcher-android-web-synced-from-phone',
    ]);

    const params = activityStore.multidevice_params(
      { host: '@all', filter_afk: true, filter_categories: [], always_active_pattern: '' },
      ['laptop', 'phone']
    );
    expect(params.host_params.laptop).toEqual({
      bid_window: 'aw-watcher-window_laptop',
      bid_afk: 'aw-watcher-afk_laptop',
      bid_browsers: ['aw-watcher-web-firefox_laptop'],
    });
    expect(params.host_params.phone).toEqual({
      bid_android: 'aw-watcher-android-synced-from-phone',
      isIos: false,
      bid_browsers: ['aw-watcher-android-web-synced-from-phone'],
    });
  });

  test('sets browser.available only when selected hosts have host-attributed browser buckets', async () => {
    const activityStore = useActivityStore();
    const bucketsStore = useBucketsStore();
    for (const method of [
      'query_multidevice_full',
      'query_active_history_multidevice',
      'query_editor',
      'query_editor_completed',
      'query_category_time_by_period',
    ]) {
      jest.spyOn(activityStore, method as any).mockResolvedValue(undefined);
    }

    bucketsStore.buckets = [
      bucket('aw-watcher-window_laptop', 'currentwindow', 'laptop'),
      bucket('aw-watcher-afk_laptop', 'afkstatus', 'laptop'),
      bucket('aw-watcher-android-synced-from-phone', 'currentwindow', 'phone'),
      bucket('aw-watcher-web-chrome', 'web.tab.current', 'unknown'),
    ] as any;

    await activityStore.ensure_loaded_multidevice(
      {
        host: '@all',
        timeperiod: { start: '2026-09-25T04:00:00+02:00', length: [1, 'day'] },
      } as any,
      ['laptop', 'phone']
    );
    expect(activityStore.browser.available).toBe(false);

    bucketsStore.buckets.push(
      bucket('aw-watcher-android-web-synced-from-phone', 'web.tab.current', 'phone') as any
    );
    await activityStore.ensure_loaded_multidevice(
      {
        host: '@all',
        timeperiod: { start: '2026-09-25T04:00:00+02:00', length: [1, 'day'] },
      } as any,
      ['laptop', 'phone']
    );
    expect(activityStore.browser.available).toBe(true);
  });

  test('query_multidevice_full completes browser state from merged browser results', async () => {
    const activityStore = useActivityStore();
    const bucketsStore = useBucketsStore();
    bucketsStore.buckets = [
      bucket('aw-watcher-window_laptop', 'currentwindow', 'laptop'),
      bucket('aw-watcher-afk_laptop', 'afkstatus', 'laptop'),
      bucket('aw-watcher-web-firefox_laptop', 'web.tab.current', 'laptop'),
      bucket('aw-watcher-android-synced-from-phone', 'currentwindow', 'phone'),
      bucket('aw-watcher-android-web-synced-from-phone', 'web.tab.current', 'phone'),
    ] as any;

    const client = getClient();
    jest.spyOn(client, 'query').mockResolvedValue([
      {
        window: {
          app_events: [],
          app_cat_events: [],
          title_events: [],
          cat_events: [],
          active_events: [],
          duration: 1800,
          host_cumulative_durations: [1200, 1800],
          host_raw_durations: [1200, 600],
        },
        browser: {
          domains: [
            { timestamp: '2026-09-25T09:00:00Z', duration: 900, data: { $domain: 'github.com' } },
          ],
          urls: [
            {
              timestamp: '2026-09-25T09:00:00Z',
              duration: 900,
              data: { url: 'https://github.com/ActivityWatch/aw-webui' },
            },
          ],
          titles: [
            {
              timestamp: '2026-09-25T09:00:00Z',
              duration: 900,
              data: { title: 'ActivityWatch/aw-webui' },
            },
          ],
          duration: 900,
        },
      },
    ]);

    await activityStore.query_multidevice_full(
      {
        host: '@all',
        filter_afk: true,
        filter_categories: [],
        timeperiod: { start: '2026-09-25T04:00:00+02:00', length: [1, 'day'] },
      } as any,
      ['laptop', 'phone']
    );

    expect(activityStore.browser.duration).toBe(900);
    expect(activityStore.browser.top_domains).toHaveLength(1);
    expect(activityStore.browser.top_domains[0].data.$domain).toBe('github.com');
    expect(activityStore.browser.top_urls).toHaveLength(1);
    expect(activityStore.browser.top_titles).toHaveLength(1);
  });
});
