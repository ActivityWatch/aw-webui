import { execFileSync } from 'child_process';
import path from 'path';
import moment from 'moment';
import { TimePeriod, hourlyLabels, timeperiodsHoursOfPeriod } from '~/util/timeperiod';

// Node reads TZ once at startup, and CI runs `npm test` with no TZ (UTC), where
// no DST transition exists. Replay this file under each relevant zone, in a
// child Jest, so the regressions stay active on a UTC runner.
const REPO_ROOT = path.resolve(__dirname, '../..');
const ZONES = ['Europe/Stockholm', 'Australia/Lord_Howe'];

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
