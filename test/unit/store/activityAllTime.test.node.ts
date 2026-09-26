import { setActivePinia, createPinia } from 'pinia';

import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { createClient } from '~/util/awclient';

createClient();

const bucket = (id: string, type: string, start: string) => ({
  id,
  type,
  hostname: 'host',
  client: 'test',
  created: start,
  last_updated: start,
  data: {},
  metadata: { start, end: start },
});

describe('get_earliest_date', () => {
  setActivePinia(createPinia());
  const activityStore = useActivityStore();
  const bucketsStore = useBucketsStore();
  jest.spyOn(bucketsStore, 'ensureLoaded').mockResolvedValue(undefined);

  test('is recomputed when the buckets change (e.g. an import)', async () => {
    bucketsStore.buckets = [
      bucket('aw-watcher-window_host', 'currentwindow', '2024-05-01T12:00:00Z'),
    ] as any;
    expect(await activityStore.get_earliest_date('host')).toBe('2024-05-01');

    bucketsStore.buckets = [
      ...bucketsStore.buckets,
      bucket('aw-watcher-window_host-imported', 'currentwindow', '2019-02-03T12:00:00Z'),
    ] as any;
    expect(await activityStore.get_earliest_date('host')).toBe('2019-02-03');
  });

  test('force skips the cache', async () => {
    bucketsStore.buckets = [
      bucket('aw-watcher-afk_host', 'afkstatus', '2023-03-03T12:00:00Z'),
    ] as any;
    expect(await activityStore.get_earliest_date('host')).toBe('2023-03-03');
    // Same bucket id, but its data changed (e.g. older events synced in)
    (bucketsStore.buckets[0] as any).metadata.start = '2021-01-01T12:00:00Z';
    expect(await activityStore.get_earliest_date('host')).toBe('2023-03-03');
    expect(await activityStore.get_earliest_date('host', { force: true })).toBe('2021-01-01');
  });
});

describe('ensure_loaded progress', () => {
  setActivePinia(createPinia());
  const activityStore = useActivityStore();

  test('is cleared when a query fails', async () => {
    const load = jest.spyOn(activityStore, 'load').mockImplementation(async opts => {
      activityStore.query_options = opts; // as start_loading does
      activityStore.progress = { done: 1, total: 3 };
      throw new Error('timeout');
    });
    await expect(
      activityStore.ensure_loaded({ host: 'host', timeperiod: {} } as any)
    ).rejects.toThrow('timeout');
    expect(activityStore.progress).toBeNull();
    load.mockRestore();
  });

  test('is kept when a newer load has taken over', async () => {
    const newer = { host: 'host', timeperiod: {} } as any;
    const load = jest.spyOn(activityStore, 'load').mockImplementation(async () => {
      // A newer ensure_loaded call started meanwhile
      activityStore.query_options = newer;
      activityStore.progress = { done: 0, total: 5 };
      throw new Error('canceled');
    });
    await expect(
      activityStore.ensure_loaded({ host: 'host', timeperiod: {}, force: true } as any)
    ).rejects.toThrow('canceled');
    expect(activityStore.progress).toEqual({ done: 0, total: 5 });
    load.mockRestore();
  });
});
