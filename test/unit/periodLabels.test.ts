import { createPinia, setActivePinia } from 'pinia';
import ActivityComponent from '~/views/activity/Activity.vue';
import { get_day_start_with_offset } from '~/util/time';
import { periodReadable } from '~/util/timeperiod';

const Activity: any = ActivityComponent;

// Period ends are exclusive: a label must name the last day inside the period.
describe('periodReadable multi-day end date', () => {
  test('a 7-day period starting 2026-11-18 reads "2026-11-18 to 2026-11-24"', () => {
    const tp = {
      start: get_day_start_with_offset('2026-11-18', '04:00'),
      length: [7, 'days'] as [number, string],
    };
    expect(periodReadable(tp)).toBe('2026-11-18 to 2026-11-24');
  });

  test('single-unit periods keep their single label', () => {
    const tp = {
      start: get_day_start_with_offset('2026-11-18', '04:00'),
      length: [1, 'day'] as [number, string],
    };
    expect(periodReadable(tp)).toBe('2026-11-18');
  });
});

describe('Activity periodReadableRange end date', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.useFakeTimers().setSystemTime(new Date('2026-11-24T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  function makeVm(periodLength: string, date: string | undefined, extra: any = {}) {
    const vm: any = {
      periodLength,
      date,
      host: 'test',
      intervalIssue: null,
      navigationNow: Date.now(),
      settingsStore: { startOfDay: '04:00' },
      $t: (k: string) => k,
      ...Activity.methods,
      ...extra,
    };
    for (const name of [
      'exactInterval',
      'dateRange',
      'invalidRange',
      'timeperiod',
      '_date',
      'periodIsBrowseable',
      'periodReadableRange',
      'todayDate',
      'allTimeRange',
    ]) {
      Object.defineProperty(vm, name, { get: () => Activity.computed[name].call(vm) });
    }
    return vm;
  }

  test('last7d on 2026-11-24 matches the equivalent inclusive custom range', () => {
    const last7 = makeVm('last7d', '2026-11-24');
    const range = makeVm('range', '2026-11-18..2026-11-24');
    // Same query period...
    expect(last7.timeperiod).toEqual(range.timeperiod);
    // ...should read the same
    expect(last7.periodReadableRange).toBe(range.periodReadableRange); // 2026-11-18—2026-11-24
  });

  test('week of Mon 2026-11-23 ends Sunday 2026-11-29', () => {
    const vm = makeVm('week', '2026-11-23', {
      settingsStore: { startOfDay: '04:00', startOfWeek: 'Monday' },
    });
    expect(vm.periodReadableRange).toBe('2026-11-23—2026-11-29');
  });
});
