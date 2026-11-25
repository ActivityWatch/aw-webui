import { execFileSync } from 'child_process';
import path from 'path';
import moment from 'moment';
import {
  TimePeriod,
  dateToTimeperiod,
  hourlyLabels,
  timeperiodToStr,
  timeperiodsAroundTimeperiod,
  timeperiodsDaysOfPeriod,
  timeperiodsHoursOfPeriod,
  timeperiodsCalendarMonthsOfPeriod,
} from '~/util/timeperiod';
import { categoryByPeriodFromChunks, periodsForFullDesktopQuery } from '~/util/desktopQuerySplit';

// Node reads TZ once at startup, and CI runs `npm test` with no TZ (UTC), where
// no DST transition exists. Replay this file under each relevant zone, in a
// child Jest, so the regressions stay active on a UTC runner.
const REPO_ROOT = path.resolve(__dirname, '../..');
const ZONES = ['Europe/Stockholm', 'Australia/Lord_Howe', 'America/Nuuk'];

if (!process.env.AW_DST_ZONE) {
  test.each(ZONES)(
    'DST regressions replay under TZ=%s',
    zone => {
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
          cwd: REPO_ROOT,
          env: { ...process.env, TZ: zone, AW_DST_ZONE: zone },
          stdio: 'pipe',
          timeout: 90000,
        }
      );
    },
    95000
  );
}

const describeZone = (zone: string) =>
  process.env.AW_DST_ZONE === zone ? describe : describe.skip;

function expectExactCoverage(periods: TimePeriod[], start: string, realHours: number) {
  expect(periods.length).toBeGreaterThan(0);
  const startM = moment(start);
  const endM = startM.clone().add(1, 'day');
  expect(endM.diff(startM, 'hours', true)).toBe(realHours);
  expect(periods[0].start).toBe(startM.format());

  let total = 0;
  periods.forEach((period, index) => {
    const periodEnd = moment(period.start).add(
      period.length[0],
      period.length[1] as moment.unitOfTime.DurationConstructor
    );
    total += periodEnd.diff(moment(period.start), 'hours', true);
    if (index > 0) {
      const previous = periods[index - 1];
      const previousEnd = moment(previous.start).add(
        previous.length[0],
        previous.length[1] as moment.unitOfTime.DurationConstructor
      );
      expect(previousEnd.format()).toBe(moment(period.start).format());
    }
  });

  const last = periods[periods.length - 1];
  const lastEnd = moment(last.start).add(
    last.length[0],
    last.length[1] as moment.unitOfTime.DurationConstructor
  );
  expect(lastEnd.format()).toBe(endM.format());
  expect(total).toBeCloseTo(realHours, 6);
}

describeZone('Europe/Stockholm')('hourly periods across a Stockholm DST day', () => {
  test('fall-back day spans 25 hours with exact coverage', () => {
    const start = moment('2026-10-24T04:00:00').format();
    const periods = timeperiodsHoursOfPeriod({ start, length: [1, 'day'] });
    expect(periods).toHaveLength(25);
    expectExactCoverage(periods, start, 25);
  });

  test('spring-forward day spans 23 hours with exact coverage', () => {
    const start = moment('2026-03-28T04:00:00').format();
    const periods = timeperiodsHoursOfPeriod({ start, length: [1, 'day'] });
    expect(periods).toHaveLength(23);
    expectExactCoverage(periods, start, 23);
  });

  test('distinguishes the repeated fall-back hour by UTC offset', () => {
    const start = moment('2026-10-24T04:00:00').format();
    const labels = hourlyLabels({ start, length: [1, 'day'] });
    expect(labels).toHaveLength(25);
    expect(labels.filter(l => l.startsWith('2 '))).toEqual(['2 (+02:00)', '2 (+01:00)']);
    expect(labels).toContain('4');
  });
});

describeZone('Australia/Lord_Howe')('hourly periods with 30-minute DST (Lord Howe)', () => {
  test('24.5-hour fall-back day clips the final interval', () => {
    const start = moment('2026-04-05T00:30:00').format();
    const periods = timeperiodsHoursOfPeriod({ start, length: [1, 'day'] });
    expect(periods).toHaveLength(25);
    expectExactCoverage(periods, start, 24.5);
    expect(periods[periods.length - 1].length[0]).toBeCloseTo(0.5, 6);
  });

  test('23.5-hour spring-forward day clips the final interval', () => {
    const start = moment('2026-10-04T00:30:00').format();
    const periods = timeperiodsHoursOfPeriod({ start, length: [1, 'day'] });
    expect(periods).toHaveLength(24);
    expectExactCoverage(periods, start, 23.5);
    expect(periods[periods.length - 1].length[0]).toBeCloseTo(0.5, 6);
  });

  test('labels carry the half-hour and stay unique', () => {
    const start = moment('2026-04-05T00:30:00').format();
    const labels = hourlyLabels({ start, length: [1, 'day'] });
    expect(labels).toHaveLength(25);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels[0]).toBe('0:30');
    expect(labels[1]).toBe('1:30');
    expect(labels[2]).toBe('2');
  });
});

// A configured start of day inside the spring-forward gap resolves to the first
// instant after it (02:00 -> 03:00 on the transition day). The next day still
// starts at the configured time, so the transition day is a 23 h (23.5 h) day
// and must end exactly where the next one starts, never an hour/30 min later.
function endOf(tp: TimePeriod): string {
  return timeperiodToStr(tp).split('/')[1];
}

function expectDayEndsAtNextDayStart(date: string, nextDate: string, offset: string) {
  const day = dateToTimeperiod(date, offset);
  const next = dateToTimeperiod(nextDate, offset);
  expect(endOf(day)).toBe(moment(next.start).format());
}

describeZone('Europe/Stockholm')('start of day inside the Stockholm spring-forward gap', () => {
  test.each(['02:00', '02:30'])('day ends where the next day starts (%s)', offset => {
    expectDayEndsAtNextDayStart('2026-03-29', '2026-03-30', offset);
    // The gap day itself starts at 03:00; its neighbours are unaffected.
    expectDayEndsAtNextDayStart('2026-03-28', '2026-03-29', offset);
    expectDayEndsAtNextDayStart('2026-03-30', '2026-03-31', offset);
  });

  test('gap day is 23 hourly buckets with exact coverage', () => {
    const tp = dateToTimeperiod('2026-03-29', '02:00');
    const periods = timeperiodsHoursOfPeriod(tp);
    expect(periods).toHaveLength(23);
    const last = periods[periods.length - 1];
    expect(moment(last.start).add(1, 'hour').format()).toBe(
      moment(dateToTimeperiod('2026-03-30', '02:00').start).format()
    );
  });

  test('hourly chart labels match the 23 buckets of the gap day', () => {
    const tp = dateToTimeperiod('2026-03-29', '02:00');
    const labels = hourlyLabels(tp);
    expect(labels).toHaveLength(23);
    expect(labels[0]).toBe('3');
    expect(labels[labels.length - 1]).toBe('1');
    // Without the requested start of day, the chart would draw a 24th bucket
    expect(hourlyLabels({ start: tp.start, length: tp.length })).toHaveLength(24);
  });

  test('neighbouring history periods start at each real day start', () => {
    const tp = dateToTimeperiod('2026-03-29', '02:00');
    const around = timeperiodsAroundTimeperiod(tp);
    around.forEach((p, i) => {
      const date = moment('2026-03-29')
        .add(i - 15, 'days')
        .format('YYYY-MM-DD');
      expect(moment(p.start).format()).toBe(moment(dateToTimeperiod(date, '02:00').start).format());
    });
    around.slice(0, -1).forEach((p, i) => {
      expect(endOf(p)).toBe(moment(around[i + 1].start).format());
    });
  });

  test('days of a week crossing the gap are contiguous and keep the offset', () => {
    const tp = {
      ...dateToTimeperiod('2026-03-26', '02:00'),
      length: [7, 'days'] as [number, string],
    };
    const days = timeperiodsDaysOfPeriod(tp);
    expect(days).toHaveLength(7);
    days.slice(0, -1).forEach((p, i) => {
      expect(endOf(p)).toBe(moment(days[i + 1].start).format());
    });
    expect(moment(days[4].start).format('HH:mm')).toBe('02:00'); // 2026-03-30
  });

  test('monthly totals use the requested day start and cover the exact range', () => {
    const tp = dateToTimeperiod('2026-03-29', '02:00', [100, 'days']);
    const months = timeperiodsCalendarMonthsOfPeriod(tp);
    expect(endOf(months[0])).toBe(moment(dateToTimeperiod('2026-04-01', '02:00').start).format());
    expect(endOf(months[months.length - 1])).toBe(endOf(tp));
    months.slice(0, -1).forEach((p, i) => {
      expect(endOf(p)).toBe(months[i + 1].start);
    });
    const chunks = periodsForFullDesktopQuery(tp, new Date('2027-01-01')).map(
      period =>
        [
          period,
          {
            window: {
              cat_events: [
                { timestamp: period.split('/')[0], duration: 1, data: { $category: ['Work'] } },
              ],
            },
          },
        ] as [string, any]
    );
    const totals = Object.values(categoryByPeriodFromChunks(tp, chunks)).map(
      m => m.cat_events[0].duration
    );
    expect(totals).toEqual([3, 30, 31, 30, 6]);
  });

  test('year chunks cover the full year even when starting on the gap day', () => {
    const tp = dateToTimeperiod('2026-03-29', '02:00', [1, 'year']);
    const chunks = periodsForFullDesktopQuery(tp, new Date('2028-01-01'));
    expect(chunks).toHaveLength(365);
    expect(chunks[0].split('/')[0]).toBe(tp.start);
    chunks.slice(0, -1).forEach((p, i) => {
      expect(p.split('/')[1]).toBe(chunks[i + 1].split('/')[0]);
    });
    expect(chunks[chunks.length - 1].split('/')[1]).toBe(endOf(tp));
  });

  test('controls: a normal 04:00 day and the fall-back day are unchanged', () => {
    expectDayEndsAtNextDayStart('2026-03-29', '2026-03-30', '04:00');
    expectDayEndsAtNextDayStart('2026-10-25', '2026-10-26', '02:00');
    const fall = timeperiodsHoursOfPeriod(dateToTimeperiod('2026-10-25', '04:00'));
    expect(fall).toHaveLength(24);
  });
});

describeZone('America/Nuuk')('start of day in a gap crossing midnight', () => {
  test.each(['23:00', '23:30'])('keeps nominal calendar dates for %s boundaries', offset => {
    expectDayEndsAtNextDayStart('2026-03-27', '2026-03-28', offset);
    expectDayEndsAtNextDayStart('2026-03-28', '2026-03-29', offset);
    const week = dateToTimeperiod('2026-03-26', offset, [7, 'days']);
    const days = timeperiodsDaysOfPeriod(week);
    days.forEach((p, i) => {
      const date = moment.utc('2026-03-26').add(i, 'days').format('YYYY-MM-DD');
      expect(p.start).toBe(dateToTimeperiod(date, offset).start);
      if (i > 0) expect(endOf(days[i - 1])).toBe(p.start);
    });
    expect(endOf(days[6])).toBe(endOf(week));
    const range = dateToTimeperiod('2026-03-28', offset, [100, 'days']);
    const months = timeperiodsCalendarMonthsOfPeriod(range);
    expect(endOf(months[0])).toBe(dateToTimeperiod('2026-04-01', offset).start);
    expect(months.every(p => p.length[0] > 0)).toBe(true);
    expect(endOf(months[months.length - 1])).toBe(endOf(range));
  });
});

describeZone('Australia/Lord_Howe')('start of day inside the Lord Howe 30-minute gap', () => {
  test.each(['02:00', '02:15'])('day ends where the next day starts (%s)', offset => {
    expectDayEndsAtNextDayStart('2026-10-04', '2026-10-05', offset);
    expectDayEndsAtNextDayStart('2026-10-03', '2026-10-04', offset);
  });

  test('gap day covers 23.5 hours with a clipped final bucket', () => {
    const tp = dateToTimeperiod('2026-10-04', '02:00');
    const periods = timeperiodsHoursOfPeriod(tp);
    const nextStart = moment(dateToTimeperiod('2026-10-05', '02:00').start);
    const total = periods.reduce((sum, p) => sum + p.length[0], 0);
    // 02:30 -> next 02:00 is 23.5 elapsed hours
    expect(total).toBeCloseTo(23.5, 6);
    const last = periods[periods.length - 1];
    expect(moment(last.start).add(last.length[0], 'hour').format()).toBe(nextStart.format());
  });
});
