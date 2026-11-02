import { execFileSync } from 'child_process';
import path from 'path';
import moment from 'moment';
import { mount } from '@vue/test-utils';
import { BAlert, BButton, BFormRadioGroup } from 'bootstrap-vue';
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

// Use the real BootstrapVue controls: their v-model/change ordering is part of the contract.
describe('time interval controls', () => {
  let wrapper: any;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 9, 29, 12));
  });

  afterEach(() => {
    wrapper?.destroy();
    jest.useRealTimers();
  });

  function create(propsData = {}) {
    wrapper = mount(InputTimeIntervalComponent, {
      propsData: { defaultDuration: 3600, maxDuration: 31 * 86400, ...propsData },
      stubs: {
        'b-alert': BAlert,
        'b-button': BButton,
        'b-form-radio-group': BFormRadioGroup,
        icon: true,
      },
      filters: { friendlytime: () => 'now' },
    });
    return wrapper;
  }

  function lastRange() {
    return wrapper.emitted('input').slice(-1)[0][0];
  }

  function expectSeconds(seconds) {
    const [start, end] = lastRange();
    expect(end.diff(start, 'seconds', true)).toBe(seconds);
  }

  async function mode(value) {
    await wrapper.find(`input[type="radio"][value="${value}"]`).setChecked();
  }

  async function dates(start, end = '') {
    await mode('range');
    await wrapper.find('input[aria-label="Start date"]').setValue(start);
    await wrapper.find('input[aria-label="End date (optional)"]').setValue(end);
  }

  function button(text) {
    return wrapper.findAll('button').wrappers.find(b => b.text() === text);
  }

  test.each(['Apply', 'Today', 'Shift'])(
    '%s preserves the selected relative duration across mode changes and refresh',
    async action => {
      create({ defaultDuration: 7200 });
      expectSeconds(7200);
      // A subsequent user choice, not just the default, must survive.
      await wrapper.find('input#dur4').setChecked();
      expectSeconds(10800);
      await dates('2026-10-27', '2026-10-28');
      if (action === 'Apply') await button('Apply').trigger('click');
      if (action === 'Today')
        await wrapper.find('input[aria-label="Jump to today"]').trigger('click');
      if (action === 'Shift')
        await wrapper.find('input[aria-label="Shift forward one day"]').trigger('click');
      expect(lastRange()[1].isAfter(lastRange()[0])).toBe(true);
      await button('Refresh').trigger('click');
      await mode('last_duration');
      expectSeconds(10800);
      expect(wrapper.find('input#dur4').element.checked).toBe(true);
      jest.advanceTimersByTime(10000);
      await button('Refresh').trigger('click');
      expectSeconds(10800);
      expect(lastRange()[1].valueOf()).toBe(Date.now());
      // Editing an inactive date range must not prevent relative refresh or quick choices.
      await mode('range');
      await wrapper.find('input[aria-label="End date (optional)"]').setValue('2020-01-01');
      await mode('last_duration');
      await wrapper.find('input#dur0').setChecked();
      expectSeconds(900);
    }
  );

  test.each([
    ['2026-01-01', '2026-01-31', 31 * 86400, true, '2026-02-01'],
    ['2026-01-01', '2026-02-01', 31 * 86400, false, null],
    ['2026-01-01', '2026-01-01', 86400, true, '2026-01-02'],
    ['2026-01-01', '', 86400, true, '2026-01-02'],
    ['2026-01-01', '', 3600, false, null],
    ['2026-01-01', '2026-02-01', null, true, '2026-02-02'],
    ['2026-01-02', '2026-01-01', null, false, null],
    ['', '', null, false, null],
  ])(
    'validates the emitted exclusive interval: %s through %s (cap %s)',
    async (start, end, maxDuration, allowed, exclusiveEnd) => {
      create({ maxDuration });
      await dates(start, end);
      const apply = button('Apply');
      expect(apply.element.disabled).toBe(!allowed);
      const before = wrapper.emitted('input').length;
      // Method guard must agree with the disabled control too.
      wrapper.vm.applyRange();
      await wrapper.vm.$nextTick();
      expect(wrapper.emitted('input').length).toBe(before + (allowed ? 1 : 0));
      if (allowed) {
        expect(lastRange()[0].format('YYYY-MM-DD')).toBe(start);
        expect(lastRange()[1].format('YYYY-MM-DD')).toBe(exclusiveEnd);
        if (maxDuration !== null)
          expect(lastRange()[1].diff(lastRange()[0], 'seconds', true)).toBeLessThanOrEqual(
            maxDuration
          );
      }
    }
  );

  // Node reads TZ at startup; replay in a child so default UTC CI exercises DST too.
  if (process.env.TZ !== 'Europe/Stockholm') {
    test('replays DST cases in Europe/Stockholm', () => {
      expect(() =>
        execFileSync(
          process.execPath,
          [
            require.resolve('jest/bin/jest'),
            '--selectProjects',
            'jsdom',
            '--runInBand',
            '--coverage=false',
            '--runTestsByPath',
            __filename,
            '--testNamePattern=uses elapsed seconds across DST',
          ],
          {
            cwd: path.resolve(__dirname, '../..'),
            env: { ...process.env, TZ: 'Europe/Stockholm' },
            stdio: 'pipe',
            timeout: 60000,
          }
        )
      ).not.toThrow();
    }, 65000);
  }

  // Dates remain whole local days; maxDuration is an elapsed-seconds ceiling.
  const describeStockholm = process.env.TZ === 'Europe/Stockholm' ? describe : describe.skip;
  describeStockholm('DST boundaries', () => {
    test.each([
      ['2026-03-29', 23 * 3600, true],
      ['2026-10-25', 25 * 3600, false],
    ])('uses elapsed seconds across DST on %s', async (day, seconds, allowed) => {
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Stockholm');
      create({ maxDuration: 86400 });
      await dates(day);
      expect(wrapper.vm.value[1].diff(wrapper.vm.value[0], 'seconds')).toBe(seconds);
      expect(button('Apply').element.disabled).toBe(!allowed);
      const before = wrapper.emitted('input').length;
      wrapper.vm.applyRange();
      expect(wrapper.emitted('input').length).toBe(before + (allowed ? 1 : 0));
    });
  });
});
