import { createPinia, setActivePinia } from 'pinia';
import ActivityComponent from '~/views/activity/Activity.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const Activity: any = ActivityComponent;

beforeEach(() => {
  setActivePinia(createPinia());
  // Local time, not UTC: the view works in local dates, so a UTC instant would
  // land on a different day east of UTC and make these tests timezone-dependent.
  jest.useFakeTimers().setSystemTime(new Date(2026, 9, 20, 18, 0, 0));
});
afterEach(() => jest.useRealTimers());

function makeVm(periodLength: string, date: string | undefined) {
  const vm: any = {
    periodLength,
    date,
    host: 'test',
    hostParam: 'all',
    settingsStore: { startOfDay: '04:00' },
    $t: (k: string) => k,
    ...Activity.methods,
  };
  for (const name of [
    'exactInterval',
    'dateRange',
    'invalidRange',
    'invalidUrlPeriod',
    'periodLengths',
    'timeperiod',
    '_date',
    'periodIsBrowseable',
    'periodReadableRange',
    'allTimeRange',
    'link_prefix',
  ]) {
    Object.defineProperty(vm, name, { get: () => Activity.computed[name].call(vm) });
  }
  return vm;
}

// ActivityWatch/aw-webui#1328 item 10
describe('Activity URL date and period validation', () => {
  test.each(['2026-02-30', 'garbage', '2026-1-5'])(
    'an invalid :date %p warns and shows today',
    date => {
      const vm = makeVm('day', date);
      expect(vm.invalidUrlPeriod).toBe(true);
      expect(vm._date).toBe('2026-10-20');
      expect(vm.previousPeriod()).toBe('2026-10-19');
    }
  );

  test('an unknown :periodLength warns and renders a single day instead of throwing', () => {
    const vm = makeVm('foo', '2026-10-15');
    expect(vm.invalidUrlPeriod).toBe(true);
    expect(vm.timeperiod.length).toEqual([1, 'day']);
    // The day in the URL still applies, so the date picker moves the view.
    expect(vm.periodReadableRange).toBe('2026-10-15—2026-10-16');
    // Previous/Next build day links, otherwise they would keep re-entering `foo`.
    expect(vm.link_prefix).toBe('/activity/all/day');
  });

  // Object.prototype names are inherited, so a plain `in` check accepted them and
  // the duration lookup then returned Object's constructor instead of a duration.
  test.each(['constructor', 'toString', 'hasOwnProperty'])(
    'the inherited name %p is not treated as a period',
    periodLength => {
      const vm = makeVm(periodLength, '2026-10-15');
      expect(vm.invalidUrlPeriod).toBe(true);
      expect(vm.timeperiod.length).toEqual([1, 'day']);
      expect(vm.link_prefix).toBe('/activity/all/day');
    }
  );

  test.each([
    ['day', '2026-10-15'],
    ['week', '2026-10-15'],
    ['last7d', undefined],
    ['range', '2026-10-01..2026-10-05'],
  ])('a valid %s URL is not flagged', (periodLength, date) => {
    const vm = makeVm(periodLength, date);
    expect(vm.invalidUrlPeriod).toBe(false);
  });
});
