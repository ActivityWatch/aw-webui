import { createPinia, setActivePinia } from 'pinia';

import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { createClient } from '~/util/awclient';

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
      // Simulate host A's completed bars, keyed like the real query would key them.
      store.invalidate_active_history({ cache_key: store.active_history_cache_key(options) });
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
});
