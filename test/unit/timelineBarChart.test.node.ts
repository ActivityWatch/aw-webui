jest.mock('vue-chartjs/legacy', () => ({ Bar: {} }));
import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import { execFileSync } from 'child_process';
import path from 'path';
import TimelineBarChart from '~/visualizations/TimelineBarChart.vue';
import { i18n } from '~/i18n';
import { hourlyLabels, timeperiodsHoursOfPeriod } from '~/util/timeperiod';

// Inspect computed Chart.js configuration without mounting a canvas in Node.
const computed = (TimelineBarChart as any).computed;

function chartOptions(count: number, resolution = 'days') {
  return computed.chartOptions.call({ timeperiod_length: [count, resolution] });
}

function chartLabels(timeperiod_start: string | null, count = 1, resolution = 'day') {
  return computed.labels.call({
    timeperiod_start,
    timeperiod_length: [count, resolution],
    clamp_hourly: false,
  }) as string[];
}

describe('TimelineBarChart options', () => {
  test('puts responsive height controls in options, not chart data', () => {
    const options = chartOptions(7);
    expect(options.responsive).toBe(true);
    expect(options.maintainAspectRatio).toBe(false);
    const data = computed.chartData.call({
      datasets: [],
      labels: [],
      timeperiod_length: [7, 'days'],
      clamp_hourly: false,
    });
    expect(data).not.toHaveProperty('responsive');
    expect(data).not.toHaveProperty('maintainAspectRatio');
  });

  test('reserves one-hour scale and minute ticks for the single-day chart', () => {
    expect(chartOptions(1).scales.y.suggestedMax).toBe(1);
    expect(chartOptions(1).scales.y.ticks.stepSize).toBe(0.25);
    for (const days of [7, 30, 90, 365]) {
      expect(chartOptions(days).scales.y.suggestedMax).toBeUndefined();
      expect(chartOptions(days).scales.y.ticks.stepSize).toBeUndefined();
    }
  });
});

describe('TimelineBarChart hourly labels', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('emits one label per hourly interval for a single day', () => {
    const start = moment('2026-01-15T04:00:00').format();
    const labels = chartLabels(start);
    expect(labels).toHaveLength(timeperiodsHoursOfPeriod({ start, length: [1, 'day'] }).length);
    expect(labels).toHaveLength(24);
  });

  test('uses actual interval starts, not the current day-start setting', () => {
    const start = moment('2026-01-15T07:30:00').format();
    expect(chartLabels(start)).toEqual([
      '7:30',
      '8:30',
      '9:30',
      '10:30',
      '11:30',
      '12:30',
      '13:30',
      '14:30',
      '15:30',
      '16:30',
      '17:30',
      '18:30',
      '19:30',
      '20:30',
      '21:30',
      '22:30',
      '23:30',
      '0:30',
      '1:30',
      '2:30',
      '3:30',
      '4:30',
      '5:30',
      '6:30',
    ]);
  });

  test('keeps 24 hourly labels for no-start callers (Report)', () => {
    // Report passes datasets only, reusing the default `[1, 'day']` timeperiod.
    // Preserve its legacy no-start labels; report query semantics are separate.
    const labels = chartLabels(null);
    expect(labels).toHaveLength(24);
    expect(labels.every(l => /^\d+$/.test(l))).toBe(true);
  });
});

describe('TimelineBarChart weekly labels', () => {
  let originalLocale: string;
  beforeEach(() => {
    originalLocale = i18n.locale;
    i18n.locale = 'en-US';
  });
  afterEach(() => {
    i18n.locale = originalLocale;
  });

  test('labels a single weekly bar with its start date, not seven weekdays', () => {
    expect(chartLabels('2026-01-05T00:00:00', 1, 'weeks')).toEqual(['Jan 5']);
  });

  test('labels each weekly bar across the year boundary', () => {
    expect(chartLabels('2026-12-21T00:00:00', 4, 'weeks')).toEqual([
      'Dec 21',
      'Dec 28',
      'Jan 4',
      'Jan 11',
    ]);
  });

  test('keeps singular week as seven consecutive weekday labels', () => {
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
    expect(chartLabels('2026-01-05T00:00:00', 1, 'week')).toEqual(
      [5, 6, 7, 8, 9, 10, 11].map(day => weekday.format(new Date(2026, 0, day, 12)))
    );
  });
});

if (process.env.TZ !== 'Europe/Stockholm') {
  test('replays chart DST labels under Europe/Stockholm on UTC CI', () => {
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
          cwd: path.resolve(__dirname, '../..'),
          env: { ...process.env, TZ: 'Europe/Stockholm' },
          stdio: 'pipe',
          timeout: 60000,
        }
      )
    ).not.toThrow();
  }, 65000);
}

const describeStockholm = process.env.TZ === 'Europe/Stockholm' ? describe : describe.skip;
describeStockholm('TimelineBarChart DST labels', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test.each([
    ['2026-03-28T04:00:00', 23],
    ['2026-10-24T04:00:00', 25],
    ['2026-10-19T04:00:00', 24],
  ])('pairs labels with every query interval for %s', (start, count) => {
    const labels = chartLabels(moment(start).format());
    expect(labels).toHaveLength(count);
    expect(labels).toEqual(hourlyLabels({ start, length: [1, 'day'] }));
    expect(new Set(labels).size).toBe(count);
  });

  test.each([
    ['2026-03-23T00:00:00', ['Mar 23', 'Mar 30', 'Apr 6'], -60, -120],
    ['2026-10-19T00:00:00', ['Oct 19', 'Oct 26', 'Nov 2'], -120, -60],
  ])(
    'keeps weekly labels on their calendar dates across DST from %s',
    (start, expected, before, after) => {
      // Prove this fixture crosses a real offset change, including on UTC CI's child run.
      expect(new Date(start).getTimezoneOffset()).toBe(before);
      const nextWeek = new Date(start);
      nextWeek.setDate(nextWeek.getDate() + 7);
      expect(nextWeek.getTimezoneOffset()).toBe(after);
      const originalLocale = i18n.locale;
      try {
        i18n.locale = 'en-US';
        expect(chartLabels(start, 3, 'weeks')).toEqual(expected);
      } finally {
        i18n.locale = originalLocale;
      }
    }
  );

  test('distinguishes the two autumn 02:00 intervals', () => {
    expect(
      chartLabels(moment('2026-10-24T04:00:00').format()).filter(l => l.startsWith('2 '))
    ).toEqual(['2 (+02:00)', '2 (+01:00)']);
  });
});
