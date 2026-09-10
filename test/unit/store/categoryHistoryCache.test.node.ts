import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import { useActivityStore } from '~/stores/activity';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { createClient } from '~/util/awclient';
import { invalidatePeriodCaches, PeriodCache } from '~/util/periodCache';

function setup() {
  setActivePinia(createPinia());
  const client = createClient(true);
  const query = jest.spyOn(client, 'query').mockResolvedValue([{ cat_events: [] }]);
  const store = useActivityStore();
  store.buckets.window = ['window'];
  store.buckets.afk = ['afk'];
  const options = {
    host: 'test',
    timeperiod: { start: moment('2020-01-01').format(), length: [2, 'day'] as [number, string] },
  };
  return { store, query, options };
}

test('reuses closed periods including empty results, invalidates on query changes and writes', async () => {
  const { store, query, options } = setup();
  await store.query_category_time_by_period(options);
  await store.query_category_time_by_period(options);
  expect(query).toHaveBeenCalledTimes(2);
  useCategoryStore().classes = [{ name: ['Work'], rule: { type: 'regex', regex: 'vim' } }];
  await store.query_category_time_by_period(options);
  expect(query).toHaveBeenCalledTimes(4);
  invalidatePeriodCaches();
  await store.query_category_time_by_period(options);
  expect(query).toHaveBeenCalledTimes(6);
  await store.query_category_time_by_period({ ...options, force: true });
  expect(query).toHaveBeenCalledTimes(8);
  expect(query.mock.calls[0][2]).toMatchObject({ cache: false });
});

test('refreshes the open period while reusing completed hours', async () => {
  const { store, query } = setup();
  const options = {
    host: 'test',
    timeperiod: { start: moment().startOf('day').format(), length: [1, 'day'] as [number, string] },
  };
  await store.query_category_time_by_period(options);
  const first = query.mock.calls.length;
  await store.query_category_time_by_period(options);
  expect(query).toHaveBeenCalledTimes(first + 1);
});

test('expired entries and bounded eviction trigger a fresh lookup', () => {
  const cache = new PeriodCache<number>(2, 100);
  cache.set('a', 1, 0);
  cache.set('b', 2, 0);
  cache.set('c', 3, 0);
  expect(cache.get('a', 50)).toBeUndefined();
  expect(cache.get('c', 50)).toBe(3);
  expect(cache.get('c', 100)).toBeUndefined();
});

test('skips history for views that do not consume it', async () => {
  const { store, options } = setup();
  jest.spyOn(useSettingsStore(), 'ensureLoaded').mockResolvedValue();
  jest.spyOn(useBucketsStore(), 'ensureLoaded').mockResolvedValue();
  jest.spyOn(store, 'get_buckets').mockResolvedValue();
  jest.spyOn(store, 'query_desktop_full').mockResolvedValue();
  jest.spyOn(store, 'query_active_history').mockResolvedValue();
  const history = jest.spyOn(store, 'query_category_time_by_period').mockResolvedValue();
  await store.ensure_loaded({ ...options, include_category_history: false });
  expect(history).not.toHaveBeenCalled();
  await store.ensure_loaded({ ...options, include_category_history: true });
  expect(history).toHaveBeenCalledTimes(1);
});
