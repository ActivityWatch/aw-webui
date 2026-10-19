import moment from 'moment';
import { get_day_start_with_offset, get_day_end_with_offset, get_day_period } from '~/util/time';
import WorkReport from '~/views/WorkReport.vue';
import BillingView from '~/views/BillingView.vue';

// A refresh instant with nonzero seconds and milliseconds. Report boundaries
// built from "now" must not inherit them.
const NOW = moment('2026-10-19T12:34:47.321').toDate();

function expectOnBoundary(iso, hour, minute) {
  const m = moment(iso);
  expect([m.hours(), m.minutes(), m.seconds(), m.milliseconds()]).toEqual([hour, minute, 0, 0]);
}

function expectPeriodsOnBoundary(periods, hour, minute) {
  expect(periods.length).toBeGreaterThan(0);
  for (const period of periods) {
    const [start, end] = period.split('/');
    expectOnBoundary(start, hour, minute);
    expectOnBoundary(end, hour, minute);
  }
}

describe('configured day boundaries', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test.each([
    ['04:00', 4, 0],
    ['00:00', 0, 0],
    ['05:30', 5, 30],
  ])('start/end with offset %s have zero seconds at any refresh instant', (offset, h, m) => {
    const now = moment();
    expectOnBoundary(get_day_start_with_offset(now, offset), h, m);
    expectOnBoundary(get_day_end_with_offset(now, offset), h, m);
  });

  test('an event at 04:00:05 falls inside the day that starts at 04:00', () => {
    const [start, end] = get_day_period(moment(), '04:00').split('/');
    const event = moment('2026-10-19T04:00:05');
    expect(event.isSameOrAfter(start) && event.isBefore(end)).toBe(true);
  });

  test('the input Moment is not mutated', () => {
    const input = moment();
    const before = input.toISOString();
    get_day_start_with_offset(input, '04:00');
    get_day_end_with_offset(input, '04:00');
    expect(input.toISOString()).toBe(before);
  });

  test.each(['last7d', 'last30d', 'thisWeek', 'thisMonth'])(
    'WorkReport %s periods start and end on the configured boundary',
    dateRange => {
      const ctx = { settingsStore: { startOfDay: '04:00' }, dateRange };
      expectPeriodsOnBoundary(WorkReport.methods.getTimeperiods.call(ctx), 4, 0);
    }
  );

  test.each(['last7d', 'last30d', 'thisWeek', 'thisMonth'])(
    'Billing %s period starts and ends on the configured boundary',
    dateRange => {
      const ctx = { settingsStore: { startOfDay: '04:00' }, dateRange };
      expectPeriodsOnBoundary([BillingView.methods.getTimeperiod.call(ctx)], 4, 0);
    }
  );
});
