import { createPinia, setActivePinia } from 'pinia';
import ActivityComponent from '~/views/activity/Activity.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const Activity: any = ActivityComponent;

beforeEach(() => {
  setActivePinia(createPinia());
  jest.useFakeTimers().setSystemTime(new Date('2026-10-20T18:00:00Z'));
});
afterEach(() => jest.useRealTimers());

// A view model whose computed members are evaluated lazily against itself
function makeVm(periodLength: string, date: string | undefined, extra: any = {}) {
  const vm: any = {
    periodLength,
    date,
    host: 'test',
    intervalIssue: null,
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
    'nextDisabled',
    'todayDate',
    'allTimeRange',
    'periodusage',
  ]) {
    Object.defineProperty(vm, name, {
      get: () => Activity.computed[name].call(vm),
    });
  }
  return vm;
}

const SEGMENT = '2026-10-20T13:00:00Z..2026-10-20T14:30:00Z';

describe('Activity exact interval period', () => {
  test('a valid segment becomes the exact elapsed TimePeriod without a day-start offset', () => {
    const vm = makeVm('interval', SEGMENT);
    expect(vm.invalidRange).toBe(false);
    expect(vm.timeperiod.length).toEqual([90 * 60 * 1000, 'milliseconds']);
    expect(new Date(vm.timeperiod.start).toISOString()).toBe('2026-10-20T13:00:00.000Z');
    // Neighbouring-period usage history is meaningless for an exact interval
    expect(vm.periodusage).toEqual([]);
  });

  test.each([
    '',
    'garbage',
    '2026-10-20..2026-10-21',
    '2026-10-20T14:00:00Z..2026-10-20T13:00:00Z',
  ])(
    'invalid segment %p warns and falls back to today instead of querying nothing or crashing',
    segment => {
      const vm = makeVm('interval', segment);
      expect(vm.invalidRange).toBe(true);
      expect(vm.timeperiod.length).toEqual([1, 'day']);
      expect(() => vm.periodReadableRange).not.toThrow();
    }
  );

  test('previous and next shift both instants by the elapsed duration', () => {
    const vm = makeVm('interval', SEGMENT);
    expect(vm.previousPeriod()).toBe('2026-10-20T11:30:00Z..2026-10-20T13:00:00Z');
    expect(vm.nextPeriod()).toBe('2026-10-20T14:30:00Z..2026-10-20T16:00:00Z');
    expect(vm.nextDisabled).toBe(false);
    // Next window would start at "now" (18:00Z), which has no data yet
    const late = makeVm('interval', '2026-10-20T16:30:00Z..2026-10-20T18:00:00Z');
    expect(late.nextDisabled).toBe(true);
  });

  test('the label shows times, not a date-only day', () => {
    const vm = makeVm('interval', SEGMENT);
    expect(vm.periodReadableRange).toMatch(/\d{2}:\d{2}:\d{2}/);
  });

  test('switching to exact times from a day keeps that day as exact bounds', () => {
    const pushPeriod = jest.fn();
    const vm = makeVm('day', undefined, { pushPeriod });
    Activity.methods.setDate.call(vm, vm._date, 'interval');
    expect(pushPeriod).toHaveBeenCalledTimes(1);
    const [kind, segment] = pushPeriod.mock.calls[0];
    expect(kind).toBe('interval');
    const [start, end] = segment.split('..').map((s: string) => Date.parse(s));
    expect(end - start).toBe(24 * 3600 * 1000);
    expect(start).toBe(Date.parse(vm.timeperiod.start));
  });

  test('navigation clears a pending offset choice before refreshing the new period', () => {
    const vm = makeVm('interval', SEGMENT, {
      intervalIssue: { field: 'start', wall: '2026-10-25T02:30', options: [] },
      refresh: jest.fn(),
    });
    vm.date = vm.nextPeriod();
    Activity.watch.timeperiod.call(vm);
    expect(vm.intervalIssue).toBeNull();
    expect(vm.refresh).toHaveBeenCalledTimes(1);
  });

  describe('editInterval', () => {
    test('editing an exact second preserves both bounds at second precision', () => {
      const pushPeriod = jest.fn();
      const vm = makeVm('interval', '2026-10-20T13:00:45Z..2026-10-20T13:01:15Z', {
        pushPeriod,
      });
      vm.editInterval('start', vm.instantToWall(vm.exactInterval.start));
      expect(vm.intervalIssue).toBeNull();
      expect(pushPeriod).toHaveBeenCalledWith(
        'interval',
        '2026-10-20T13:00:45Z..2026-10-20T13:01:15Z'
      );
    });

    test('pushes the new start with the other end unchanged', () => {
      const pushPeriod = jest.fn();
      const vm = makeVm('interval', SEGMENT, { pushPeriod });
      vm.editInterval('start', '2026-10-20T12:00');
      expect(vm.intervalIssue).toBeNull();
      expect(pushPeriod).toHaveBeenCalledTimes(1);
      const [, segment] = pushPeriod.mock.calls[0];
      expect(segment.endsWith('..2026-10-20T14:30:00Z')).toBe(true);
    });

    test('rejects an end that is not after the start', () => {
      const pushPeriod = jest.fn();
      const vm = makeVm('interval', SEGMENT, { pushPeriod });
      vm.editInterval('end', '2026-10-20T10:00');
      expect(pushPeriod).not.toHaveBeenCalled();
      expect(vm.intervalIssue.message).toBe('activity.intervalEndAfterStart');
    });

    test('rejects an interval beyond the 92 day budget', () => {
      const pushPeriod = jest.fn();
      const vm = makeVm('interval', SEGMENT, { pushPeriod });
      vm.editInterval('end', '2027-06-01T10:00');
      expect(pushPeriod).not.toHaveBeenCalled();
      expect(vm.intervalIssue.message).toBe('activity.intervalTooLong');
    });
  });
});
