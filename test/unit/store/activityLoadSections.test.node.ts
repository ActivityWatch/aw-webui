import { createPinia, setActivePinia } from 'pinia';

import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { createClient, getClient } from '~/util/awclient';

createClient();

// ActivityWatch/aw-webui#1317 items 6-8: state left over from the previous
// load, and sections that a single failure used to strand.

const day = { start: '2024-01-01T00:00:00+00:00', length: [1, 'day'] } as any;

function stubDesktopLoad(store: ReturnType<typeof useActivityStore>, afkBucket: string) {
  jest.spyOn(useBucketsStore(), 'ensureLoaded').mockResolvedValue(undefined as any);
  jest.spyOn(store, 'resolve_multidevice_hosts').mockReturnValue([]);
  jest.spyOn(store, 'get_buckets').mockImplementation(async () => {
    store.buckets.afk = [afkBucket];
    store.buckets.window = [afkBucket.replace('afk', 'window')];
    store.buckets.browser = [];
    store.buckets.editor = ['aw-watcher-vim_test'];
  });
  jest.spyOn(store, 'set_available').mockImplementation(() => {
    store.window.available = true;
    store.active.available = true;
    store.editor.available = true;
  });
  jest.spyOn(store, 'queries_category_history').mockReturnValue(true);
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}

// A newer single-device load's completed bars.
function showBarsOf(store: ReturnType<typeof useActivityStore>, host: string) {
  store.start_loading({ host, timeperiod: day } as any);
  store.invalidate_active_history({ cache_key: `history-of-${host}` });
  store.query_active_history_completed({
    active_history: { p: [{ timestamp: '2024-01-01T00:00:00Z', duration: 111, data: {} }] },
  });
}

describe('activity load sections', () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => jest.restoreAllMocks());

  test('start_loading clears the previous host top stopwatches', () => {
    const store = useActivityStore();
    store.stopwatch.top_stopwatches = [
      { timestamp: '2024-01-01T00:00:00Z', duration: 1, data: { label: 'X' } },
    ];
    store.start_loading({ host: 'aw-watcher-android-test', timeperiod: day } as any);
    expect(store.stopwatch.top_stopwatches).toEqual([]);
  });

  test('a failed active-history query does not strand editor and category history', async () => {
    const store = useActivityStore();
    stubDesktopLoad(store, 'aw-watcher-afk_a');
    jest.spyOn(store, 'query_desktop_full').mockResolvedValue();
    const failure = new Error('activityQuery timed out');
    jest.spyOn(store, 'query_active_history').mockRejectedValue(failure);
    const editor = jest.spyOn(store, 'query_editor').mockResolvedValue();
    const byPeriod = jest.spyOn(store, 'query_category_time_by_period').mockResolvedValue();

    await expect(store.load({ host: 'a', timeperiod: day } as any)).rejects.toBe(failure);

    expect(editor).toHaveBeenCalledTimes(1);
    expect(byPeriod).toHaveBeenCalledTimes(1);
  });

  test('a failure after a newer load took over stops the stale load', async () => {
    const store = useActivityStore();
    stubDesktopLoad(store, 'aw-watcher-afk_a');
    jest.spyOn(store, 'query_desktop_full').mockResolvedValue();
    jest.spyOn(store, 'query_active_history').mockImplementation(async () => {
      store.start_loading({ host: 'b', timeperiod: day } as any); // newer load aborts this one
      throw new Error('aborted');
    });
    const editor = jest.spyOn(store, 'query_editor').mockResolvedValue();

    await expect(store.load({ host: 'a', timeperiod: day } as any)).rejects.toThrow('aborted');
    expect(editor).not.toHaveBeenCalled();
  });

  test('switching host drops the previous host bars before the desktop query', async () => {
    const store = useActivityStore();
    stubDesktopLoad(store, 'aw-watcher-afk_a');
    jest.spyOn(store, 'query_desktop_full').mockResolvedValue();
    jest.spyOn(store, 'query_active_history').mockImplementation(async options => {
      // Simulate host A's completed bars under some host-A cache key (any key
      // that differs from host B's; the test must not depend on new actions).
      store.invalidate_active_history({ cache_key: `history-of-${options.host}` });
      store.query_active_history_completed({
        active_history: { p: [{ timestamp: '2024-01-01T00:00:00Z', duration: 111, data: {} }] },
      });
    });
    jest.spyOn(store, 'query_editor').mockResolvedValue();
    jest.spyOn(store, 'query_category_time_by_period').mockResolvedValue();
    await store.load({ host: 'a', timeperiod: day } as any);
    expect(Object.keys(store.active.history)).toEqual(['p']);

    // Host B: while its desktop query is still running, A's bars must be gone.
    stubDesktopLoad(store, 'aw-watcher-afk_b');
    let historyDuringDesktop: Record<string, unknown> | null = null;
    jest.spyOn(store, 'query_desktop_full').mockImplementation(async () => {
      historyDuringDesktop = { ...store.active.history };
    });
    await store.load({ host: 'b', timeperiod: day } as any);
    expect(historyDuringDesktop).toEqual({});
  });

  test('leaving Activity (reset) stops the load before its remaining queries', async () => {
    const store = useActivityStore();
    stubDesktopLoad(store, 'aw-watcher-afk_a');
    jest.spyOn(store, 'query_desktop_full').mockImplementation(async () => {
      await store.reset(); // aborts the client without touching query_options
      throw new Error('aborted');
    });
    const activeHistory = jest.spyOn(store, 'query_active_history').mockResolvedValue();
    const editor = jest.spyOn(store, 'query_editor').mockResolvedValue();
    const byPeriod = jest.spyOn(store, 'query_category_time_by_period').mockResolvedValue();

    await expect(store.load({ host: 'a', timeperiod: day } as any)).rejects.toThrow('aborted');
    expect(activeHistory).not.toHaveBeenCalled();
    expect(editor).not.toHaveBeenCalled();
    expect(byPeriod).not.toHaveBeenCalled();
  });

  test('a stale load whose section completed starts no further section', async () => {
    const store = useActivityStore();
    stubDesktopLoad(store, 'aw-watcher-afk_a');
    jest.spyOn(store, 'query_desktop_full').mockImplementation(async () => {
      getClient().abort(); // a newer load cancelled this one, yet the query resolved
    });
    const activeHistory = jest.spyOn(store, 'query_active_history').mockResolvedValue();
    const editor = jest.spyOn(store, 'query_editor').mockResolvedValue();

    await store.load({ host: 'a', timeperiod: day } as any);
    expect(activeHistory).not.toHaveBeenCalled();
    expect(editor).not.toHaveBeenCalled();
  });

  test('a load superseded while its buckets load leaves the newer bars alone', async () => {
    const store = useActivityStore();
    stubDesktopLoad(store, 'aw-watcher-afk_a');
    const buckets = deferred();
    const bucketsStarted = deferred();
    jest.spyOn(store, 'get_buckets').mockImplementation(() => {
      bucketsStarted.resolve();
      return buckets.promise;
    });
    const desktop = jest.spyOn(store, 'query_desktop_full').mockResolvedValue();

    const stale = store.load({ host: 'a', timeperiod: day } as any);
    await bucketsStarted.promise; // past the check after ensureLoaded()
    showBarsOf(store, 'b');
    buckets.resolve();
    await stale;

    expect(desktop).not.toHaveBeenCalled();
    expect(Object.keys(store.active.history)).toEqual(['p']);
  });

  describe('All Devices', () => {
    function stubMultideviceLoad(store: ReturnType<typeof useActivityStore>) {
      const buckets = useBucketsStore();
      jest.spyOn(buckets, 'ensureLoaded').mockResolvedValue(undefined as any);
      jest.spyOn(buckets, 'bucketsWindow').mockImplementation((h: string) => [`window_${h}`]);
      jest.spyOn(buckets, 'bucketsAFK').mockImplementation((h: string) => [`afk_${h}`]);
      jest.spyOn(buckets, 'bucketsAndroid').mockReturnValue([]);
      jest.spyOn(store, 'resolve_multidevice_hosts').mockReturnValue(['a', 'b']);
      jest.spyOn(store, 'get_buckets_multidevice').mockImplementation(() => {
        store.buckets.editor = ['aw-watcher-vim_test'];
      });
      jest.spyOn(store, 'queries_category_history').mockReturnValue(true);
    }

    test('a load superseded while buckets load leaves the newer bars alone', async () => {
      const store = useActivityStore();
      stubMultideviceLoad(store);
      const buckets = deferred();
      jest.spyOn(useBucketsStore(), 'ensureLoaded').mockImplementation(() => buckets.promise);
      const combined = jest.spyOn(store, 'query_multidevice_full').mockResolvedValue();

      const stale = store.load({ host: '@all', timeperiod: day } as any);
      showBarsOf(store, 'a');
      buckets.resolve();
      await stale;

      expect(combined).not.toHaveBeenCalled();
      expect(Object.keys(store.active.history)).toEqual(['p']);
    });

    test('a failed combined history query does not strand editor and category history', async () => {
      const store = useActivityStore();
      stubMultideviceLoad(store);
      jest.spyOn(store, 'query_multidevice_full').mockResolvedValue();
      const failure = new Error('multideviceActivityQuery timed out');
      jest.spyOn(store, 'query_active_history_multidevice').mockRejectedValue(failure);
      const editor = jest.spyOn(store, 'query_editor').mockResolvedValue();
      const byPeriod = jest.spyOn(store, 'query_category_time_by_period').mockResolvedValue();

      await expect(store.load({ host: '@all', timeperiod: day } as any)).rejects.toBe(failure);
      expect(editor).toHaveBeenCalledTimes(1);
      expect(byPeriod).toHaveBeenCalledTimes(1);
    });

    test('switching from one device drops its bars before the combined query', async () => {
      const store = useActivityStore();
      // Host A's completed single-device bars.
      store.invalidate_active_history({ cache_key: 'history-of-a' });
      store.query_active_history_completed({
        active_history: { p: [{ timestamp: '2024-01-01T00:00:00Z', duration: 111, data: {} }] },
      });

      stubMultideviceLoad(store);
      let historyDuringQuery: Record<string, unknown> | null = null;
      jest.spyOn(store, 'query_multidevice_full').mockImplementation(async () => {
        historyDuringQuery = { ...store.active.history };
        throw new Error('combined query failed');
      });
      jest.spyOn(store, 'query_active_history_multidevice').mockResolvedValue();
      jest.spyOn(store, 'query_editor').mockResolvedValue();
      jest.spyOn(store, 'query_category_time_by_period').mockResolvedValue();

      await expect(store.load({ host: '@all', timeperiod: day } as any)).rejects.toThrow(
        'combined query failed'
      );
      expect(historyDuringQuery).toEqual({});
      expect(store.active.history).toEqual({});
    });
  });
});
