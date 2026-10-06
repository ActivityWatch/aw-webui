import {
  buildWorkReportQuery,
  getSupportedWorkReportHosts,
  getUnsupportedWorkReportHosts,
  getWorkReportHostBuckets,
  getWorkReportHostOptions,
} from '~/util/workReport';

const buckets = [
  {
    id: 'aw-watcher-window_laptop',
    hostname: 'laptop',
    device_id: 'laptop',
    type: 'currentwindow',
    data: {},
  },
  {
    id: 'aw-watcher-afk_laptop',
    hostname: 'laptop',
    device_id: 'laptop',
    type: 'afkstatus',
    data: {},
  },
  {
    id: 'aw-watcher-window_phone',
    hostname: 'phone',
    device_id: 'phone',
    type: 'currentwindow',
    data: {},
  },
];

describe('workReport host helpers', () => {
  test('getWorkReportHostOptions disables hosts without AFK buckets', () => {
    expect(getWorkReportHostOptions(buckets as any)).toEqual([
      { value: 'laptop', text: 'laptop', disabled: false },
      { value: 'phone', text: 'phone (requires aw-watcher-afk)', disabled: true },
    ]);
  });

  test('getUnsupportedWorkReportHosts returns selected hosts missing AFK buckets', () => {
    expect(getUnsupportedWorkReportHosts(['laptop', 'phone'], buckets as any)).toEqual(['phone']);
  });

  test('getSupportedWorkReportHosts returns only hosts with AFK buckets', () => {
    expect(getSupportedWorkReportHosts(['laptop', 'phone'], buckets as any)).toEqual(['laptop']);
  });

  test('buildWorkReportQuery uses single-arg flood() for both window and afk buckets', () => {
    // Regression: aw-query's flood() takes one argument. A previous version
    // passed breakTimeSeconds as a second argument, which made aw-server
    // respond with HTTP 400 "Tried to call function flood with invalid amount
    // of arguments" and broke the whole report.
    const query = buildWorkReportQuery(
      [{ host: 'laptop', window: 'aw-watcher-window_laptop', afk: 'aw-watcher-afk_laptop' }],
      '[]',
      []
    );
    expect(query).toContain('events_0 = flood(query_bucket("aw-watcher-window_laptop"));');
    expect(query).toContain('not_afk_0 = flood(query_bucket("aw-watcher-afk_laptop"));');
    // Must NOT contain flood() with two arguments
    expect(query).not.toMatch(/flood\([^)]+,[^)]+\)/);
  });

  test('buildWorkReportQuery produces a snapshot-stable query for multiple hosts', () => {
    const query = buildWorkReportQuery(
      [
        { host: 'laptop', window: 'aw-watcher-window_laptop', afk: 'aw-watcher-afk_laptop' },
        { host: 'desktop', window: 'aw-watcher-window_desktop', afk: 'aw-watcher-afk_desktop' },
      ],
      '[]',
      [['Work']]
    );
    expect(query).toMatchSnapshot();
  });

  test('getSupportedWorkReportHosts preserves selected host order', () => {
    const moreBuckets = [
      ...buckets,
      {
        id: 'aw-watcher-window_desktop',
        hostname: 'desktop',
        device_id: 'desktop',
        type: 'currentwindow',
        data: {},
      },
      {
        id: 'aw-watcher-afk_desktop',
        hostname: 'desktop',
        device_id: 'desktop',
        type: 'afkstatus',
        data: {},
      },
    ];

    expect(getSupportedWorkReportHosts(['desktop', 'phone', 'laptop'], moreBuckets as any)).toEqual(
      ['desktop', 'laptop']
    );
  });

  test('synced and Android buckets are named by hostname and queried by real id', () => {
    // Regression for ActivityWatch/aw-webui#1058: host names used to be
    // derived from bucket ids, so synced devices showed up as
    // "home-desktop-synced-from-home-desktop" and the query asked for
    // "aw-watcher-window_home-desktop-synced-from-home-desktop", which
    // doesn't exist.
    const syncedBuckets = [
      ...buckets.slice(0, 2),
      {
        id: 'aw-watcher-window_home-desktop-synced-from-home-desktop',
        hostname: 'home-desktop',
        device_id: 'home-desktop',
        type: 'currentwindow',
        data: {},
      },
      {
        id: 'aw-watcher-afk_home-desktop-synced-from-home-desktop',
        hostname: 'home-desktop',
        device_id: 'home-desktop',
        type: 'afkstatus',
        data: {},
      },
      {
        id: 'aw-watcher-android-synced-from-pixel-8',
        hostname: 'pixel-8',
        device_id: 'pixel-8',
        type: 'currentwindow',
        data: {},
      },
    ];

    expect(getWorkReportHostOptions(syncedBuckets as any)).toEqual([
      { value: 'laptop', text: 'laptop', disabled: false },
      { value: 'home-desktop', text: 'home-desktop', disabled: false },
      { value: 'pixel-8', text: 'pixel-8 (requires aw-watcher-afk)', disabled: true },
    ]);

    const hostBuckets = getWorkReportHostBuckets(
      ['home-desktop', 'pixel-8', 'laptop'],
      syncedBuckets as any
    );
    expect(hostBuckets).toEqual([
      {
        host: 'home-desktop',
        window: 'aw-watcher-window_home-desktop-synced-from-home-desktop',
        afk: 'aw-watcher-afk_home-desktop-synced-from-home-desktop',
      },
      { host: 'laptop', window: 'aw-watcher-window_laptop', afk: 'aw-watcher-afk_laptop' },
    ]);

    const query = buildWorkReportQuery(hostBuckets, '[]', []);
    expect(query).toContain(
      'events_0 = flood(query_bucket("aw-watcher-window_home-desktop-synced-from-home-desktop"));'
    );
    expect(query).toContain(
      'not_afk_0 = flood(query_bucket("aw-watcher-afk_home-desktop-synced-from-home-desktop"));'
    );
  });
});
