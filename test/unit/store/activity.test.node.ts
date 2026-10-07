import { setActivePinia, createPinia } from 'pinia';

import { chunkPeriodsBySpan, useActivityStore } from '~/stores/activity';
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

  test.each([
    ['day', [1, 'day'], 1],
    ['week', [1, 'week'], 1],
    ['month', [1, 'month'], 3],
    ['last30d', [30, 'day'], 3],
    ['year', [1, 'year'], null], // one request per (past) year
  ])('bounds active history requests to ~1 year each (%s)', async (_name, periodLength, calls) => {
    activityStore.active.history = {};
    activityStore.buckets.afk = ['aw-watcher-afk_test'];
    const querySpy = jest
      .spyOn(getClient(), 'query')
      .mockImplementation(async periods => periods.map(() => []));

    await activityStore.query_active_history({
      host: 'test',
      timeperiod: { start: '2020-01-01T00:00:00+00:00', length: periodLength },
    });

    const requested = querySpy.mock.calls.flatMap(call => call[0]);
    expect(querySpy).toHaveBeenCalledTimes(calls ?? requested.length);
    expect(Object.keys(activityStore.active.history).sort()).toEqual([...requested].sort());
    querySpy.mockRestore();
  });

  // Each chunk request returns one event list per period in that chunk; the
  // per-chunk results must be flattened so every period keeps its own data.
  test('keeps active history aligned with its period across chunks', async () => {
    activityStore.active.history = {};
    activityStore.buckets.afk = ['aw-watcher-afk_test'];
    const eventFor = (period: string) => ({
      timestamp: period.split('/')[0],
      duration: 1,
      data: { status: 'not-afk', period },
    });
    const querySpy = jest
      .spyOn(getClient(), 'query')
      .mockImplementation(async periods => periods.map(p => [eventFor(p)]));

    await activityStore.query_active_history({
      host: 'test',
      timeperiod: { start: '2020-01-01T00:00:00+00:00', length: [1, 'month'] },
    });

    expect(querySpy.mock.calls.length).toBeGreaterThan(1);
    const requested = querySpy.mock.calls.flatMap(call => call[0]);
    for (const period of requested) {
      expect(activityStore.active.history[period]).toEqual([eventFor(period)]);
    }
    querySpy.mockRestore();
  });

  test('chunkPeriodsBySpan keeps each chunk within maxDays', () => {
    const periods = [
      '2020-01-01T00:00:00Z/2020-07-01T00:00:00Z',
      '2020-07-01T00:00:00Z/2021-01-01T00:00:00Z',
      '2021-01-01T00:00:00Z/2021-01-02T00:00:00Z',
      '2021-01-02T00:00:00Z/2022-06-01T00:00:00Z',
    ];
    expect(chunkPeriodsBySpan(periods)).toEqual([
      periods.slice(0, 2),
      [periods[2]],
      [periods[3]], // longer than maxDays on its own, still sent
    ]);
    expect(chunkPeriodsBySpan([])).toEqual([]);
  });

  describe('query_browser_only', () => {
    const timeperiod = {
      start: '2024-01-01T00:00:00+00:00',
      length: [1, 'day'] as [number, string],
    };

    test('populates browser state from API response', async () => {
      activityStore.$patch(s => {
        s.buckets.browser = ['aw-watcher-firefox_test'];
      });
      const browserData = {
        domains: [{ data: { $domain: 'example.com' }, duration: 300 }],
        urls: [{ data: { url: 'https://example.com/' }, duration: 300 }],
        titles: [{ data: { title: 'Example Domain' }, duration: 300 }],
        duration: 300,
      };
      const querySpy = jest
        .spyOn(getClient(), 'query')
        .mockResolvedValueOnce([{ browser: browserData }]);

      await activityStore.query_browser_only({ host: 'test', timeperiod });

      expect(querySpy).toHaveBeenCalledTimes(1);
      expect(activityStore.browser.top_domains).toEqual(browserData.domains);
      expect(activityStore.browser.top_urls).toEqual(browserData.urls);
      expect(activityStore.browser.top_titles).toEqual(browserData.titles);
      expect(activityStore.browser.duration).toEqual(300);
      querySpy.mockRestore();
    });

    test('clears browser state when API returns empty result', async () => {
      activityStore.$patch(s => {
        s.buckets.browser = ['aw-watcher-firefox_test'];
      });
      activityStore.$patch(s => {
        s.browser.duration = 999;
      });
      const querySpy = jest.spyOn(getClient(), 'query').mockResolvedValueOnce([{}]);

      await activityStore.query_browser_only({ host: 'test', timeperiod });

      expect(activityStore.browser.duration).toBeUndefined();
      querySpy.mockRestore();
    });

    test('passes all browser bucket IDs to the query', async () => {
      activityStore.$patch(s => {
        s.buckets.browser = ['aw-watcher-chrome_test', 'aw-watcher-firefox_test'];
      });
      const querySpy = jest
        .spyOn(getClient(), 'query')
        .mockResolvedValueOnce([{ browser: { domains: [], urls: [], titles: [], duration: 0 } }]);

      await activityStore.query_browser_only({ host: 'test', timeperiod });

      expect(querySpy).toHaveBeenCalledTimes(1);
      const queryStr = (querySpy.mock.calls[0][1] as string[]).join('\n');
      expect(queryStr).toContain('aw-watcher-chrome_test');
      expect(queryStr).toContain('aw-watcher-firefox_test');
      querySpy.mockRestore();
    });
  });
});
