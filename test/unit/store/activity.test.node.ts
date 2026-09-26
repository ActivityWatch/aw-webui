import { setActivePinia, createPinia } from 'pinia';

import { useActivityStore } from '~/stores/activity';
import { useCategoryStore } from '~/stores/categories';
import { createClient, getClient } from '~/util/awclient';

describe('activity store', () => {
  setActivePinia(createPinia());
  createClient();

  const activityStore = useActivityStore();
  const categoryStore = useCategoryStore();

  beforeEach(async () => {
    await activityStore.reset();
    await activityStore.load_demo();
  });

  test('loads demo data', () => {
    // Load
    expect(categoryStore.classes).toHaveLength(0);
    categoryStore.restoreDefaultClasses();
    expect(categoryStore.classes_unsaved_changes).toBeTruthy();
    categoryStore.save();
    expect(categoryStore.classes_unsaved_changes).toBeFalsy();
    expect(categoryStore.classes).not.toHaveLength(0);

    // Retrieve class
    let workCat = categoryStore.get_category(['Work']);
    expect(workCat).not.toBeUndefined();
    workCat = JSON.parse(JSON.stringify(workCat)); // copy

    // Modify class
    const newRegex = 'Just testing';
    workCat.rule.regex = newRegex;
    categoryStore.updateClass(workCat);
    expect(categoryStore.get_category(['Work']).rule.regex).toEqual(newRegex);

    // Check that getters behave somewhat
    expect(categoryStore.all_categories).not.toHaveLength(0);
    expect(categoryStore.classes_hierarchy).not.toHaveLength(0);
  });

  test('queries year active history one period per request', async () => {
    activityStore.active.history = {};
    activityStore.buckets.afk = ['aw-watcher-afk_test'];
    const querySpy = jest
      .spyOn(getClient(), 'query')
      .mockImplementation(async periods => periods.map(() => []));

    await activityStore.query_active_history({
      host: 'test',
      timeperiod: { start: '2020-01-01T00:00:00+00:00', length: [1, 'year'] },
    });

    // 15 years before + the current one; later ones are in the future and skipped
    expect(querySpy.mock.calls.length).toBeGreaterThan(1);
    for (const call of querySpy.mock.calls) {
      expect(call[0]).toHaveLength(1);
    }
    expect(Object.keys(activityStore.active.history)).toHaveLength(querySpy.mock.calls.length);
    querySpy.mockRestore();
  });

  test('queries active history in one batch for shorter periods', async () => {
    activityStore.active.history = {};
    activityStore.buckets.afk = ['aw-watcher-afk_test'];
    const querySpy = jest
      .spyOn(getClient(), 'query')
      .mockImplementation(async periods => periods.map(() => []));

    await activityStore.query_active_history({
      host: 'test',
      timeperiod: { start: '2020-01-01T00:00:00+00:00', length: [1, 'month'] },
    });

    expect(querySpy).toHaveBeenCalledTimes(1);
    expect(querySpy.mock.calls[0][0].length).toBeGreaterThan(1);
    querySpy.mockRestore();
  });
});
