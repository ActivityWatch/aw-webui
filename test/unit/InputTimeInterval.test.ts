import moment from 'moment';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import InputTimeIntervalComponent from '~/components/InputTimeInterval.vue';
import { presetRange } from '~/util/timeperiod';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const InputTimeInterval: any = InputTimeIntervalComponent;

describe('date range shifts', () => {
  function makeVm(start = null, end = null) {
    return { start, end, mode: 'range', duration: 0, valueChanged: jest.fn() };
  }

  test.each([-7, -1, 1, 7])('does not populate an empty range when shifting %i days', days => {
    const vm = makeVm();

    InputTimeInterval.methods.shiftDays.call(vm, days);

    expect(vm.start).toBeNull();
    expect(vm.end).toBeNull();
    expect(vm.valueChanged).not.toHaveBeenCalled();
  });

  test('leaves an end-only range unchanged', () => {
    const vm = makeVm(null, '2026-10-17');

    InputTimeInterval.methods.shiftDays.call(vm, 1);

    expect(vm.start).toBeNull();
    expect(vm.end).toBe('2026-10-17');
    expect(vm.valueChanged).not.toHaveBeenCalled();
  });

  test('shifts a single-day range without filling in its optional end', () => {
    const vm = makeVm('2026-10-17');

    InputTimeInterval.methods.shiftDays.call(vm, -7);

    expect(vm.start).toBe('2026-10-10');
    expect(vm.end).toBeNull();
    expect(vm.valueChanged).toHaveBeenCalledTimes(1);
  });

  test('shifts both dates across a month boundary', () => {
    const vm = makeVm('2026-10-30', '2026-10-31');

    InputTimeInterval.methods.shiftDays.call(vm, 7);

    expect(vm.start).toBe('2026-11-06');
    expect(vm.end).toBe('2026-11-07');
    expect(vm.valueChanged).toHaveBeenCalledTimes(1);
  });

  test('Today explicitly initializes an empty range', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 17, 12));
    try {
      const vm = makeVm();
      const today = moment().format('YYYY-MM-DD');

      InputTimeInterval.methods.setToday.call(vm);

      expect(vm.start).toBe(today);
      expect(vm.end).toBe(today);
      expect(vm.valueChanged).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('date range presets', () => {
  beforeEach(() => setActivePinia(createPinia()));

  // Wednesday 4 Nov 2026
  const today = moment('2026-11-04');

  test.each([
    ['thisWeek', 'Monday', ['2026-11-02', '2026-11-04']],
    ['lastWeek', 'Monday', ['2026-10-26', '2026-11-01']],
    ['thisWeek', 'Sunday', ['2026-11-01', '2026-11-04']],
    ['lastWeek', 'Sunday', ['2026-10-25', '2026-10-31']],
    ['thisMonth', 'Monday', ['2026-11-01', '2026-11-04']],
    ['lastMonth', 'Monday', ['2026-10-01', '2026-10-31']],
  ])('%s with weeks starting %s', (preset, startOfWeek, expected) => {
    useSettingsStore().startOfWeek = startOfWeek;
    expect(presetRange(preset, today)).toEqual(expected);
  });

  test('last month from January is the previous December', () => {
    expect(presetRange('lastMonth', moment('2027-01-15'))).toEqual(['2026-12-01', '2026-12-31']);
  });

  test('unknown preset gives no range', () => {
    expect(presetRange('nope', today)).toBeNull();
  });

  test('a 31 day month is within the 31 day limit', () => {
    const vm = { start: '2026-10-01', end: '2026-10-31', maxDuration: 31 * 24 * 60 * 60 };
    expect(InputTimeInterval.computed.daterangeTooLong.call(vm)).toBe(false);
  });
});

describe('interval persistence', () => {
  const KEY = 'test-interval';

  function makeVm(): any {
    return { persistKey: KEY, mode: 'last_duration', duration: 3600, start: null, end: null, preset: null };
  }

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  test('saves and restores an explicit range', () => {
    const vm = { ...makeVm(), mode: 'range', duration: 0, start: '2026-10-05', end: '2026-10-09' };
    InputTimeInterval.methods.saveState.call(vm);

    const restored = makeVm();
    InputTimeInterval.methods.restoreState.call(restored);

    expect(restored).toMatchObject({ mode: 'range', duration: 0, start: '2026-10-05', end: '2026-10-09' });
  });

  test('restores a preset by name so it rolls forward', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ mode: 'range', duration: 0, start: '2020-01-01', end: '2020-01-31', preset: 'thisMonth' })
    );
    const vm = makeVm();

    InputTimeInterval.methods.restoreState.call(vm);

    expect(vm.preset).toBe('thisMonth');
    expect(vm.start).toBe(moment().startOf('month').format('YYYY-MM-DD'));
    expect(vm.end).toBe(moment().format('YYYY-MM-DD'));
  });

  test('restores a last duration', () => {
    localStorage.setItem(KEY, JSON.stringify({ mode: 'last_duration', duration: 7200 }));
    const vm = makeVm();

    InputTimeInterval.methods.restoreState.call(vm);

    expect(vm).toMatchObject({ mode: 'last_duration', duration: 7200 });
  });

  test('ignores corrupt storage and does nothing without a key', () => {
    localStorage.setItem(KEY, '{not json');
    const vm = makeVm();
    InputTimeInterval.methods.restoreState.call(vm);
    expect(vm).toMatchObject({ mode: 'last_duration', duration: 3600 });

    const noKey = { ...makeVm(), persistKey: null, mode: 'range', start: '2026-10-01' };
    InputTimeInterval.methods.saveState.call(noKey);
    expect(localStorage.length).toBe(0);
  });
});
