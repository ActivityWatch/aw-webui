import { execFileSync } from 'child_process';
import path from 'path';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import ActivityComponent from '~/views/activity/Activity.vue';
import { get_day_start_with_offset } from '~/util/time';
import { periodReadable } from '~/util/timeperiod';

const Activity: any = ActivityComponent;

// Like timeperiodDst.test.node.ts, replay in a fresh process so CI's UTC
// environment cannot silently skip the regression in a zone with a late DST gap.
if (!process.env.AW_PERIOD_LABEL_ZONE) {
  // eslint-disable-next-line jest/expect-expect
  test('period labels across the America/Nuuk clock change', () => {
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
      ],
      {
        cwd: path.resolve(__dirname, '../..'),
        env: { ...process.env, TZ: 'America/Nuuk', AW_PERIOD_LABEL_ZONE: 'America/Nuuk' },
        stdio: 'pipe',
        timeout: 90000,
      }
    );
  }, 95000);
}

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
      settingsStore: useSettingsStore(),
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

  test.each([
    ['Monday', '2026-11-23—2026-11-29'],
    ['Sunday', '2026-11-22—2026-11-28'],
    ['Saturday', '2026-11-21—2026-11-27'],
  ])('week labels respect a %s start', (startOfWeek, expected) => {
    useSettingsStore().startOfWeek = startOfWeek;
    const vm = makeVm('week', '2026-11-23');
    expect(vm.periodReadableRange).toBe(expected);
  });

  const describeNuuk =
    process.env.AW_PERIOD_LABEL_ZONE === 'America/Nuuk' ? describe : describe.skip;

  describeNuuk('labels across a late clock-change gap', () => {
    test('Activity ignores a day-start time skipped by the clock change', () => {
      useSettingsStore().startOfDay = '23:30';
      const last7 = makeVm('last7d', '2026-03-28');
      const range = makeVm('range', '2026-03-22..2026-03-28');
      expect(last7.timeperiod).toEqual(range.timeperiod);
      expect(last7.periodReadableRange).toBe('2026-03-22—2026-03-28');
      expect(last7.periodReadableRange).toBe(range.periodReadableRange);
    });

    test('Score ignores a day-start time skipped by the clock change', () => {
      const tp = {
        start: get_day_start_with_offset('2026-03-22', '23:30'),
        length: [7, 'days'] as [number, string],
      };
      expect(periodReadable(tp)).toBe('2026-03-22 to 2026-03-28');
    });
  });
});
