import moment from 'moment';
import InputTimeIntervalComponent from '~/components/InputTimeInterval.vue';

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
