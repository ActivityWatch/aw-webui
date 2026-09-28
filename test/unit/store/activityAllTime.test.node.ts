import { setActivePinia, createPinia } from 'pinia';

import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { createClient, getClient } from '~/util/awclient';

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
    expect(await activityStore.get_earliest_date('host')).toEqual({
      date: '2024-05-01',
      approximate: false,
    });

    bucketsStore.buckets = [
      ...bucketsStore.buckets,
      bucket('aw-watcher-window_host-imported', 'currentwindow', '2019-02-03T12:00:00Z'),
    ] as any;
    expect(await activityStore.get_earliest_date('host')).toEqual({
      date: '2019-02-03',
      approximate: false,
    });
  });

  test('force skips the cache', async () => {
    bucketsStore.buckets = [
      bucket('aw-watcher-afk_host', 'afkstatus', '2023-03-03T12:00:00Z'),
    ] as any;
    expect(await activityStore.get_earliest_date('host')).toEqual({
      date: '2023-03-03',
      approximate: false,
    });
    // Same bucket id, but its data changed (e.g. older events synced in)
    (bucketsStore.buckets[0] as any).metadata.start = '2021-01-01T12:00:00Z';
    expect(await activityStore.get_earliest_date('host')).toEqual({
      date: '2023-03-03',
      approximate: false,
    });
    expect(await activityStore.get_earliest_date('host', { force: true })).toEqual({
      date: '2021-01-01',
      approximate: false,
    });
  });
});

describe('get_earliest_date fallback', () => {
  setActivePinia(createPinia());
  const activityStore = useActivityStore();
  const bucketsStore = useBucketsStore();
  jest.spyOn(bucketsStore, 'ensureLoaded').mockResolvedValue(undefined);

  test('marks a result from bucket creation dates as approximate', async () => {
    // No metadata.start (aw-server), and the events lookup fails
    bucketsStore.buckets = [
      {
        ...bucket('aw-watcher-window_host', 'currentwindow', '2024-05-01T12:00:00Z'),
        metadata: {},
        first_seen: '2025-01-02T12:00:00Z',
      },
    ] as any;
    const getEvents = jest.spyOn(getClient(), 'getEvents').mockRejectedValue(new Error('timeout'));
    expect(await activityStore.get_earliest_date('host', { force: true })).toEqual({
      date: '2025-01-02',
      approximate: true,
    });
    getEvents.mockRestore();
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
