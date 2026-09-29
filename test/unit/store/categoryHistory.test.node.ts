import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import { useActivityStore } from '~/stores/activity';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { createClient } from '~/util/awclient';

function setup() {
  setActivePinia(createPinia());
  const client = createClient(true);
  const query = jest.spyOn(client, 'query').mockResolvedValue([{ cat_events: [] }]);
  const store = useActivityStore();
  jest.spyOn(useSettingsStore(), 'ensureLoaded').mockResolvedValue();
  jest.spyOn(useBucketsStore(), 'ensureLoaded').mockResolvedValue();
  jest.spyOn(store, 'get_buckets').mockImplementation(async () => {
    store.buckets.window = ['window'];
    store.buckets.afk = ['afk'];
  });
  jest.spyOn(store, 'set_available').mockImplementation(() => {
    store.window.available = true;
  });
  jest.spyOn(store, 'query_desktop_full').mockResolvedValue();
  jest.spyOn(store, 'query_active_history').mockResolvedValue();
  const options = {
    host: 'test',
    timeperiod: { start: moment('2020-01-01').format(), length: [2, 'day'] as [number, string] },
  };
  return { store, query, options };
}

test('skips history for views that do not consume it', async () => {
  const { store, query, options } = setup();
  await store.ensure_loaded({ ...options, include_category_history: false });
  expect(query).not.toHaveBeenCalled();
  await store.ensure_loaded({ ...options, include_category_history: true });
  // One query per day
  expect(query).toHaveBeenCalledTimes(2);
});

test('skipped loads keep history only while its inputs are unchanged', async () => {
  const { store, options } = setup();

  await store.ensure_loaded({ ...options, include_category_history: true });
  const loaded = store.category.by_period;
  expect(loaded).not.toBeNull();

  // Same inputs: a view that doesn't render history leaves it in place for
  // consumers like Report that read it without reloading.
  await store.ensure_loaded({ ...options, include_category_history: false });
  expect(store.category.by_period).toBe(loaded);

  // Changed category rules alter the query, so the retained periods no longer
  // describe the current data and must be dropped even though the range and
  // filters are unchanged.
  useCategoryStore().classes = [{ name: ['Work'], rule: { type: 'regex', regex: 'vim' } }];
  await store.ensure_loaded({ ...options, include_category_history: false });
  expect(store.category.by_period).toBeNull();
});

test('ensure_category_history loads skipped history once', async () => {
  const { store, query, options } = setup();
  await store.ensure_loaded({ ...options, include_category_history: false });
  await store.ensure_category_history();
  expect(query).toHaveBeenCalledTimes(2);
  expect(store.category.by_period).not.toBeNull();
  expect(store.progress).toBeNull();
  // Already loaded for this query
  await store.ensure_category_history();
  expect(query).toHaveBeenCalledTimes(2);
});

test('ensure_category_history leaves history derived from the full query alone', async () => {
  const { store, query } = setup();
  await store.ensure_loaded({
    host: 'test',
    // Long custom range: monthly bars derived from the full query's chunks
    timeperiod: { start: moment('2020-01-01').format(), length: [120, 'day'] },
    include_category_history: false,
  });
  await store.ensure_category_history();
  expect(query).not.toHaveBeenCalled();
});
