import { createPinia, setActivePinia } from 'pinia';
import ActivityComponent from '~/views/activity/Activity.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const Activity: any = ActivityComponent;

beforeEach(() => {
  setActivePinia(createPinia());
  jest.useFakeTimers().setSystemTime(new Date('2026-10-20T18:00:00Z'));
});
afterEach(() => jest.useRealTimers());

function makeVm(periodLength: string, date: string | undefined) {
  const vm: any = {
    periodLength,
    date,
    host: 'test',
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
    expect(vm.periodReadableRange).toBe('2026-10-20—2026-10-21');
  });

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
