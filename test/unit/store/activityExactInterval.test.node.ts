import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import { useActivityStore } from '~/stores/activity';
import { createClient, getClient } from '~/util/awclient';
import { exactIntervalToTimeperiod } from '~/util/timeperiod';

describe('category query for an exact interval', () => {
  beforeAll(() => createClient());

  beforeEach(() => {
    setActivePinia(createPinia());
    jest.useFakeTimers().setSystemTime(new Date('2027-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test('requests clipped buckets that partition exactly the selected interval', async () => {
    const store = useActivityStore();
    store.buckets.afk = ['aw-watcher-afk_test'];
    store.buckets.window = ['aw-watcher-window_test'];
    const query = jest
      .spyOn(getClient(), 'query')
      .mockImplementation(async periods => periods.map(() => [{ cat_events: [] }]) as any);
    const timeperiod = exactIntervalToTimeperiod({
      start: '2026-10-20T13:15:00Z',
      end: '2026-10-20T15:00:00Z',
    });

    await store.query_category_time_by_period({ host: 'test', timeperiod });

    const requested = query.mock.calls.flatMap(call => call[0]);
    const intervals = requested.map((p: string) => p.split('/').map(x => moment(x).valueOf()));
    expect(intervals[0][0]).toBe(moment('2026-10-20T13:15:00Z').valueOf());
    expect(intervals[intervals.length - 1][1]).toBe(moment('2026-10-20T15:00:00Z').valueOf());
    intervals.forEach(([, to], i) => {
      if (i) expect(intervals[i][0]).toBe(intervals[i - 1][1]);
      expect(to).toBeLessThanOrEqual(moment('2026-10-20T15:00:00Z').valueOf());
    });
    expect(requested).toHaveLength(2);
    expect(Object.keys(store.category.by_period)).toEqual(requested);
  });
});
