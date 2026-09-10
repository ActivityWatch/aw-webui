import { setActivePinia, createPinia } from 'pinia';

import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { useSettingsStore } from '~/stores/settings';
import * as awclient from '~/util/awclient';

// Captures the query the store submits, without reaching a server.
function mockQuery(result: unknown[] = []) {
  const query = jest.fn().mockResolvedValue(result);
  jest.spyOn(awclient, 'getClient').mockReturnValue({
    query,
    abort: jest.fn(),
    req: { defaults: {} },
  } as any);
  return query;
}

const HOST = 'testhost';

function seedBuckets(hosts: Record<string, { window?: boolean; browser?: boolean }>) {
  const buckets: any[] = [];
  for (const [host, has] of Object.entries(hosts)) {
    buckets.push({ id: `aw-watcher-afk_${host}`, type: 'afkstatus', hostname: host, data: {} });
    if (has.window) {
      buckets.push({
        id: `aw-watcher-window_${host}`,
        type: 'currentwindow',
        hostname: host,
        data: {},
      });
    }
    if (has.browser) {
      buckets.push({
        id: `aw-watcher-web-firefox_${host}`,
        type: 'web.tab.current',
        hostname: host,
        data: {},
      });
    }
  }
  useBucketsStore().update_buckets(buckets);
}

const TIMEPERIOD = { start: '2026-09-10T00:00:00+00:00', length: [1, 'day'] as [number, string] };

describe('query_active_history caching', () => {
  let activityStore: any;
  let query: jest.Mock;

  const DESKTOP_BUCKETS = {
    afk: [`aw-watcher-afk_${HOST}`],
    window: [`aw-watcher-window_${HOST}`],
    browser: [],
    editor: [],
    android: [],
    stopwatch: [],
  };

  beforeEach(() => {
    setActivePinia(createPinia());
    useSettingsStore().$patch({ _loaded: true, startOfDay: '00:00', useMultidevice: false });
    activityStore = useActivityStore();
    jest.restoreAllMocks();
    // activeDurationQuery returns an event array per period on this branch.
    query = mockQuery([]);
    query.mockImplementation(async (periods: string[]) =>
      periods.map((tp: string) => [{ timestamp: tp.split('/')[0], duration: 60, data: {} }])
    );
    activityStore.buckets = { ...DESKTOP_BUCKETS };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const run = (options: Record<string, unknown> = {}) =>
    activityStore.query_active_history({ host: HOST, timeperiod: TIMEPERIOD, ...options });

  const periodsAsked = () => query.mock.calls.map(call => call[0]);

  test('repeating the same request skips cached closed periods', async () => {
    await run();
    const first = periodsAsked()[0];
    expect(first.length).toBeGreaterThan(0);

    await run();
    const second = periodsAsked()[1];

    // Only the still-open period may be refetched.
    expect(second.length).toBeLessThan(first.length);
    for (const tp of second) {
      const [start, end] = tp.split('/').map((d: string) => new Date(d).getTime());
      const now = Date.now();
      expect(start <= now && now < end).toBe(true);
    }
  });

  test('a cached empty result is not refetched', async () => {
    query.mockImplementation(async (periods: string[]) =>
      periods.map((tp: string) => [{ timestamp: tp.split('/')[0], duration: 0, data: {} }])
    );
    await run();
    const first = periodsAsked()[0];

    await run();
    const second = periodsAsked()[1];

    // Every closed period returned 0 and must still count as cached.
    expect(second.length).toBeLessThan(first.length);
  });

  test('navigating a nearby date only queries the newly needed periods', async () => {
    await run();
    const first = periodsAsked()[0];

    await activityStore.query_active_history({
      host: HOST,
      timeperiod: { start: '2026-09-11T00:00:00+00:00', length: [1, 'day'] },
    });
    const second = periodsAsked()[1];

    expect(second.length).toBeGreaterThan(0);
    // Anything already fetched is re-requested only if it is the open period,
    // whose duration is still growing.
    const overlap = second.filter((tp: string) => first.includes(tp));
    for (const tp of overlap) {
      const [start, end] = tp.split('/').map((d: string) => new Date(d).getTime());
      expect(start <= Date.now() && Date.now() < end).toBe(true);
    }
  });

  test('no request is sent when nothing is missing', async () => {
    // A period window entirely in the past, so there is no open period.
    const pastPeriod = {
      start: '2020-01-05T00:00:00+00:00',
      length: [1, 'day'] as [number, string],
    };
    await activityStore.query_active_history({ host: HOST, timeperiod: pastPeriod });
    expect(query).toHaveBeenCalledTimes(1);

    await activityStore.query_active_history({ host: HOST, timeperiod: pastPeriod });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('force reload bypasses the cache', async () => {
    await run();
    const first = periodsAsked()[0];

    await run({ force: true });
    expect(periodsAsked()[1]).toEqual(first);
  });

  test.each([
    ['host change', { host: 'otherhost' }],
    ['include_audible change', { include_audible: true }],
    ['always_active_pattern change', { always_active_pattern: 'mpv' }],
  ])('%s cannot reuse cached periods', async (_label, override) => {
    await run();
    const first = periodsAsked()[0];

    await activityStore.query_active_history({ host: HOST, timeperiod: TIMEPERIOD, ...override });
    expect(periodsAsked()[1]).toEqual(first);
  });

  test('a day-boundary change cannot reuse cached periods', async () => {
    await run();
    expect(Object.keys(activityStore.active.history).length).toBeGreaterThan(0);

    useSettingsStore().$patch({ startOfDay: '04:00' });
    await run();

    // The old key no longer matches, so everything was refetched.
    expect(periodsAsked()[1]).toEqual(periodsAsked()[0]);
  });

  test('a source-bucket change cannot reuse cached periods', async () => {
    await run();
    const first = periodsAsked()[0];

    activityStore.buckets = { ...DESKTOP_BUCKETS, browser: ['aw-watcher-web-firefox_testhost'] };
    await run({ include_audible: true });

    expect(periodsAsked()[1]).toEqual(first);
  });

  test('switching multidevice mode cannot reuse cached periods', async () => {
    await run();
    const first = periodsAsked()[0];

    seedBuckets({ [HOST]: { window: true } });
    useSettingsStore().$patch({ useMultidevice: true });
    await run();

    expect(periodsAsked()[1]).toEqual(first);
  });

  test('a delayed response from the previous host cannot populate the new one', async () => {
    let releaseA: (v: unknown) => void = () => {
      throw new Error('releaseA called before the pending mock was installed');
    };
    query.mockImplementationOnce(
      (periods: string[]) =>
        new Promise(resolve => {
          releaseA = () =>
            resolve(
              periods.map((tp: string) => [
                { timestamp: tp.split('/')[0], duration: 111, data: {} },
              ])
            );
        })
    );

    // Host A's request starts but does not resolve.
    const pendingA = run();
    // Host B completes first.
    query.mockImplementation(async (periods: string[]) =>
      periods.map((tp: string) => [{ timestamp: tp.split('/')[0], duration: 222, data: {} }])
    );
    await activityStore.query_active_history({ host: 'hostB', timeperiod: TIMEPERIOD });

    const afterB = { ...activityStore.active.history };
    expect(Object.keys(afterB).length).toBeGreaterThan(0);

    // Now A's stale response lands.
    releaseA(null);
    await pendingA;

    for (const [tp, events] of Object.entries(activityStore.active.history)) {
      expect((events as any[])[0].duration).not.toBe(111);
      expect(afterB[tp]).toBeDefined();
    }
  });

  test('a failed request leaves the cache untouched and is retryable', async () => {
    query.mockRejectedValueOnce(new Error('offline'));
    await expect(run()).rejects.toThrow('offline');
    expect(activityStore.active.history).toEqual({});

    query.mockImplementation(async (periods: string[]) =>
      periods.map((tp: string) => [{ timestamp: tp.split('/')[0], duration: 60, data: {} }])
    );
    await run();
    expect(Object.keys(activityStore.active.history).length).toBeGreaterThan(0);
  });

  test('the open period keeps growing across repeated requests', async () => {
    query.mockImplementation(async (periods: string[]) =>
      periods.map((tp: string) => [{ timestamp: tp.split('/')[0], duration: 100, data: {} }])
    );
    await run();

    const openPeriod = periodsAsked()[0].find((tp: string) => {
      const [start, end] = tp.split('/').map((d: string) => new Date(d).getTime());
      return start <= Date.now() && Date.now() < end;
    });
    expect(openPeriod).toBeDefined();
    expect(activityStore.active.history[openPeriod].duration).toBeUndefined();
    expect(activityStore.active.history[openPeriod][0].duration).toBe(100);

    query.mockImplementation(async (periods: string[]) =>
      periods.map((tp: string) => [{ timestamp: tp.split('/')[0], duration: 250, data: {} }])
    );
    await run();
    expect(activityStore.active.history[openPeriod][0].duration).toBe(250);
  });
});

describe('query_active_history_android caching', () => {
  let activityStore: any;
  let query: jest.Mock;

  beforeEach(() => {
    setActivePinia(createPinia());
    useSettingsStore().$patch({ _loaded: true, startOfDay: '00:00', useMultidevice: false });
    activityStore = useActivityStore();
    jest.restoreAllMocks();
    query = mockQuery([]);
    // activityQueryAndroid returns a total per period, not events.
    query.mockImplementation(async (periods: string[]) => periods.map(() => 60));
    activityStore.buckets = {
      afk: [],
      window: [],
      browser: [],
      editor: [],
      android: ['aw-watcher-android-test_phone'],
      stopwatch: [],
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const run = (options: Record<string, unknown> = {}) =>
    activityStore.query_active_history_android({
      host: 'phone',
      timeperiod: TIMEPERIOD,
      ...options,
    });

  test('skips cached closed periods on a repeat request', async () => {
    await run();
    const first = query.mock.calls[0][0];
    await run();
    expect(query.mock.calls[1][0].length).toBeLessThan(first.length);
  });

  test('does not query future periods, matching desktop', async () => {
    await run();
    const now = Date.now();
    for (const tp of query.mock.calls[0][0]) {
      expect(new Date(tp.split('/')[0]).getTime()).toBeLessThan(now);
    }
  });

  test('force reload bypasses the cache', async () => {
    await run();
    const first = query.mock.calls[0][0];
    await run({ force: true });
    expect(query.mock.calls[1][0]).toEqual(first);
  });

  test('a bucket change cannot reuse cached periods', async () => {
    await run();
    const first = query.mock.calls[0][0];

    activityStore.buckets = {
      ...activityStore.buckets,
      android: ['aw-import-screentime_phone'],
    };
    await run();
    expect(query.mock.calls[1][0]).toEqual(first);
  });

  test('still produces status-carrying events with the returned duration', async () => {
    await run();
    const tp = query.mock.calls[0][0][0];
    expect(activityStore.active.history[tp][0].data).toEqual({ status: 'not-afk' });
    expect(activityStore.active.history[tp][0].duration).toBe(60);
  });
});
