import { execFileSync } from 'child_process';
import path from 'path';
import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import { useActivityStore } from '~/stores/activity';
import { createClient, getClient } from '~/util/awclient';
import { TimePeriod, timeperiodToStr } from '~/util/timeperiod';

// Node reads TZ at process startup; changing it inside Jest does not change
// the VM's Date timezone. Keep these regressions active in the default UTC CI.
if (process.env.TZ !== 'Europe/Stockholm') {
  test('runs category-query DST regressions in Europe/Stockholm', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [
          require.resolve('jest/bin/jest'),
          '--selectProjects',
          'node',
          '--runInBand',
          '--coverage=false',
          '--runTestsByPath',
          __filename,
        ],
        {
          cwd: path.resolve(__dirname, '../../..'),
          env: { ...process.env, TZ: 'Europe/Stockholm' },
          stdio: 'pipe',
          timeout: 60000,
        }
      )
    ).not.toThrow();
  }, 65000);
}

// The activity day starts at 04:00 and crosses the following morning's
// clock change, rather than starting at midnight.
const describeStockholm = process.env.TZ === 'Europe/Stockholm' ? describe : describe.skip;
describeStockholm('single-day category query coverage across DST', () => {
  beforeAll(() => createClient());

  beforeEach(() => {
    setActivePinia(createPinia());
    jest.useFakeTimers().setSystemTime(new Date('2027-01-01T00:00:00Z'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test.each([
    ['spring-forward', '2026-03-28T04:00:00', 23],
    ['fall-back', '2026-10-24T04:00:00', 25],
    ['ordinary day', '2026-10-19T04:00:00', 24],
  ])('%s requests exactly the selected interval (%s)', async (_name, start, hours) => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Stockholm');
    const store = useActivityStore();
    store.buckets.afk = ['aw-watcher-afk_test'];
    store.buckets.window = ['aw-watcher-window_test'];
    const query = jest.spyOn(getClient(), 'query').mockImplementation(async periods =>
      periods.map(period => [
        {
          timestamp: period.split('/')[0],
          duration: moment.duration(1, 'hour').asSeconds(),
          data: { $category: ['Work'] },
        },
      ])
    );
    const timeperiod: TimePeriod = { start: moment(start).format(), length: [1, 'day'] };
    const before = JSON.stringify(timeperiod);
    const full = timeperiodToStr(timeperiod).split('/').map(Date.parse);
    expect(full[1] - full[0]).toBe(hours * 3600000);

    await store.query_category_time_by_period({ host: 'test', timeperiod });

    const requested = query.mock.calls.flatMap(call => call[0]);
    expect(requested).toHaveLength(hours);
    const intervals = requested.map(period => period.split('/').map(Date.parse));
    expect(intervals[0][0]).toBe(full[0]);
    expect(intervals[intervals.length - 1][1]).toBe(full[1]);
    intervals.forEach(([from, to], index) => {
      expect(to - from).toBe(3600000);
      if (index) expect(from).toBe(intervals[index - 1][1]);
    });
    // Each response must stay paired with its actual query period, including
    // the two different UTC offsets for the repeated autumn hour.
    expect(Object.keys(store.category.by_period)).toEqual(requested);
    expect(JSON.stringify(timeperiod)).toBe(before);
  });
});
