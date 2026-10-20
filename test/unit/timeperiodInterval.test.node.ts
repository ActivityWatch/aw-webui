import { execFileSync } from 'child_process';
import path from 'path';
import moment from 'moment';
import {
  MAX_INTERVAL_MS,
  exactBucketLabels,
  exactIntervalReadable,
  exactIntervalToTimeperiod,
  formatExactInterval,
  hourlyLabels,
  instantToWall,
  parseExactInterval,
  splitTimeperiodStrs,
  shiftExactInterval,
  timeperiodToStr,
  timeperiodsForBarchart,
  wallTimeInstants,
} from '~/util/timeperiod';

// Same replay trick as timeperiodDst.test.node.ts: DST behaviour needs a
// non-UTC TZ, which Node reads once at startup.
const REPO_ROOT = path.resolve(__dirname, '../..');
const ZONE = 'Europe/Stockholm';

if (!process.env.AW_INTERVAL_ZONE) {
  // eslint-disable-next-line jest/expect-expect
  test(`interval regressions replay under TZ=${ZONE}`, () => {
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
        env: { ...process.env, TZ: ZONE, AW_INTERVAL_ZONE: ZONE },
        stdio: 'pipe',
        timeout: 90000,
      }
    );
  }, 95000);
}

const describeZone = process.env.AW_INTERVAL_ZONE === ZONE ? describe : describe.skip;

describe('parseExactInterval', () => {
  const ok = '2026-10-20T13:00:00Z..2026-10-20T14:00:00Z';

  test('accepts offset-bearing whole-second instants and canonicalizes to UTC', () => {
    expect(parseExactInterval(ok)).toEqual({
      start: '2026-10-20T13:00:00Z',
      end: '2026-10-20T14:00:00Z',
    });
    expect(parseExactInterval('2026-10-20T15:00:00+02:00..2026-10-20T16:30:00+02:00')).toEqual({
      start: '2026-10-20T13:00:00Z',
      end: '2026-10-20T14:30:00Z',
    });
  });

  test.each([
    ['empty', ''],
    ['one endpoint', '2026-10-20T13:00:00Z'],
    ['three endpoints', `${ok}..2026-10-20T15:00:00Z`],
    ['date-only', '2026-10-20..2026-10-21'],
    ['mixed date-only', '2026-10-20..2026-10-20T14:00:00Z'],
    ['naked local time', '2026-10-20T13:00:00..2026-10-20T14:00:00'],
    ['fractional seconds', '2026-10-20T13:00:00.5Z..2026-10-20T14:00:00Z'],
    ['no seconds', '2026-10-20T13:00Z..2026-10-20T14:00Z'],
    ['impossible date', '2026-02-30T13:00:00Z..2026-03-01T14:00:00Z'],
    ['hour 24', '2026-10-20T24:00:00Z..2026-10-21T01:00:00Z'],
    ['equal bounds', '2026-10-20T13:00:00Z..2026-10-20T13:00:00Z'],
    ['reversed bounds', '2026-10-20T14:00:00Z..2026-10-20T13:00:00Z'],
    ['reversed across midnight', '2026-10-21T01:00:00Z..2026-10-20T23:00:00Z'],
  ])('rejects %s', (_name, str) => {
    expect(parseExactInterval(str)).toBeNull();
  });

  test('rejects intervals beyond the bucket budget', () => {
    const start = moment.utc('2026-01-01T00:00:00Z');
    const end = start.clone().add(MAX_INTERVAL_MS + 1000, 'milliseconds');
    expect(
      parseExactInterval(
        `${start.format('YYYY-MM-DDTHH:mm:ss[Z]')}..${end.format('YYYY-MM-DDTHH:mm:ss[Z]')}`
      )
    ).toBeNull();
  });

  test('formats back to the same segment', () => {
    const parsed = parseExactInterval(ok);
    expect(parsed).not.toBeNull();
    if (!parsed) return;
    expect(formatExactInterval(parsed)).toBe(ok);
  });

  test('survives URL-style encoding of +, : and ..', () => {
    const segment = '2026-10-20T15:00:00+02:00..2026-10-20T16:00:00+02:00';
    const decoded = decodeURIComponent(encodeURIComponent(segment));
    expect(parseExactInterval(decoded)).toEqual(parseExactInterval(segment));
    // A raw '+' in a path stays '+' (not a space) when parsed from the path
    expect(parseExactInterval(segment)).not.toBeNull();
  });
});

describe('exact interval timeperiod', () => {
  const interval = { start: '2026-10-20T13:00:00Z', end: '2026-10-20T14:30:00Z' };

  test('keeps the exact elapsed duration in milliseconds', () => {
    const tp = exactIntervalToTimeperiod(interval);
    expect(tp.length).toEqual([90 * 60 * 1000, 'milliseconds']);
    expect(
      timeperiodToStr(tp)
        .split('/')
        .map(s => moment(s).valueOf())
    ).toEqual([moment(interval.start).valueOf(), moment(interval.end).valueOf()]);
  });

  test('shifts both bounds by the elapsed duration', () => {
    expect(shiftExactInterval(interval, 1)).toEqual({
      start: '2026-10-20T14:30:00Z',
      end: '2026-10-20T16:00:00Z',
    });
    expect(shiftExactInterval(interval, -1)).toEqual({
      start: '2026-10-20T11:30:00Z',
      end: '2026-10-20T13:00:00Z',
    });
    expect(shiftExactInterval(shiftExactInterval(interval, 1), -1)).toEqual(interval);
  });

  test('readable label shows times and never reads as a date-only day', () => {
    const label = exactIntervalReadable(exactIntervalToTimeperiod(interval));
    expect(label).toMatch(/\d{2}:\d{2}:\d{2}/);
    expect(label).not.toMatch(/today/i);
  });
});

describe('exact interval buckets', () => {
  const bounds = (periods: { start: string; length: [number, string] }[]) =>
    periods.map(timeperiodToStr).map(s => s.split('/').map(x => moment(x).valueOf()));

  const expectPartition = (
    periods: { start: string; length: [number, string] }[],
    startMs: number,
    endMs: number
  ) => {
    const b = bounds(periods);
    expect(b[0][0]).toBe(startMs);
    expect(b[b.length - 1][1]).toBe(endMs);
    for (let i = 1; i < b.length; i++) expect(b[i][0]).toBe(b[i - 1][1]);
  };

  test('one hour is one bucket, not a throw', () => {
    const tp = exactIntervalToTimeperiod({
      start: '2026-10-20T13:00:00Z',
      end: '2026-10-20T14:00:00Z',
    });
    const periods = timeperiodsForBarchart(tp);
    expect(periods).toHaveLength(1);
    expectPartition(
      periods,
      moment('2026-10-20T13:00:00Z').valueOf(),
      moment('2026-10-20T14:00:00Z').valueOf()
    );
  });

  test('clips the final hourly bucket and never rounds up', () => {
    const tp = exactIntervalToTimeperiod({
      start: '2026-10-20T13:15:00Z',
      end: '2026-10-20T15:00:00Z',
    });
    const periods = timeperiodsForBarchart(tp);
    expect(periods).toHaveLength(2);
    expect(periods[1].length[0]).toBeCloseTo(0.75);
    expectPartition(
      periods,
      moment('2026-10-20T13:15:00Z').valueOf(),
      moment('2026-10-20T15:00:00Z').valueOf()
    );
    expect(hourlyLabels(tp)).toHaveLength(periods.length);
  });

  test('intervals longer than a day use daily chunks with a clipped end', () => {
    const tp = exactIntervalToTimeperiod({
      start: '2026-10-20T13:00:00Z',
      end: '2026-10-22T19:00:00Z',
    });
    const periods = timeperiodsForBarchart(tp);
    expect(periods).toHaveLength(3);
    expect(periods[2].length[1]).toBe('milliseconds');
    expectPartition(
      periods,
      moment('2026-10-20T13:00:00Z').valueOf(),
      moment('2026-10-22T19:00:00Z').valueOf()
    );
  });

  test('exactly 24 elapsed hours is hourly; 24h + 1s moves to one clipped day', () => {
    const day = timeperiodsForBarchart(
      exactIntervalToTimeperiod({ start: '2026-10-20T13:00:00Z', end: '2026-10-21T13:00:00Z' })
    );
    expect(day).toHaveLength(24);
    const over = timeperiodsForBarchart(
      exactIntervalToTimeperiod({ start: '2026-10-20T13:00:00Z', end: '2026-10-21T13:00:01Z' })
    );
    expect(over).toHaveLength(2);
  });
});

describe('Android/editor splitting of an exact interval', () => {
  test('keeps the exact bounds and clips the last chunk', () => {
    const tp = exactIntervalToTimeperiod({
      start: '2026-10-20T13:00:00Z',
      end: '2026-10-23T01:00:00Z',
    });
    const chunks = splitTimeperiodStrs(tp, 1).map(c => c.split('/').map(x => moment(x).valueOf()));
    expect(chunks).toHaveLength(3);
    expect(chunks[0][0]).toBe(moment('2026-10-20T13:00:00Z').valueOf());
    expect(chunks[2][1]).toBe(moment('2026-10-23T01:00:00Z').valueOf());
    chunks.forEach(([, to], i) => i < 2 && expect(chunks[i + 1][0]).toBe(to));
  });
});

describe('exact interval chart labels', () => {
  test('labels match the bucket count for hourly and daily intervals', () => {
    for (const [start, end] of [
      ['2026-10-20T13:00:00Z', '2026-10-20T14:00:00Z'],
      ['2026-10-20T13:15:00Z', '2026-10-20T15:00:00Z'],
      ['2026-10-20T13:00:00Z', '2026-10-22T19:00:00Z'],
    ]) {
      const tp = exactIntervalToTimeperiod({ start, end });
      expect(exactBucketLabels(tp)).toHaveLength(timeperiodsForBarchart(tp).length);
    }
  });

  test('multi-day labels carry the date', () => {
    const labels = exactBucketLabels(
      exactIntervalToTimeperiod({ start: '2026-10-20T13:00:00Z', end: '2026-10-22T19:00:00Z' })
    );
    labels.forEach(l => expect(l).toMatch(/^\d{4}-\d{2}-\d{2}/));
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describeZone('DST handling (Europe/Stockholm)', () => {
  test('rejects a nonexistent spring-forward wall time', () => {
    expect(wallTimeInstants('2026-03-29T02:30')).toEqual([]);
    expect(wallTimeInstants('2026-03-29T03:30')).toEqual(['2026-03-29T01:30:00Z']);
  });

  test('exposes both occurrences of the repeated fall-back hour', () => {
    expect(wallTimeInstants('2026-10-25T02:30')).toEqual([
      '2026-10-25T00:30:00Z',
      '2026-10-25T01:30:00Z',
    ]);
  });

  test('ordinary wall times map to a single instant', () => {
    expect(wallTimeInstants('2026-10-20T13:00')).toEqual(['2026-10-20T11:00:00Z']);
    expect(wallTimeInstants('not-a-time')).toEqual([]);
  });

  test('round-trips instant -> wall -> instant', () => {
    const wall = instantToWall('2026-10-20T11:00:00Z');
    expect(wall).toBe('2026-10-20T13:00');
    expect(wallTimeInstants(wall)).toContain('2026-10-20T11:00:00Z');
  });

  test('a fall-back interval buckets the repeated hour once each, with distinct labels', () => {
    const tp = exactIntervalToTimeperiod({
      start: '2026-10-24T22:00:00Z',
      end: '2026-10-25T02:00:00Z',
    });
    const periods = timeperiodsForBarchart(tp);
    expect(periods).toHaveLength(4);
    const labels = hourlyLabels(tp);
    expect(new Set(labels).size).toBe(4);
    expect(labels.filter(l => l.includes('('))).toHaveLength(2);
  });

  test('a spring-forward day-long interval is 23 elapsed hours of buckets', () => {
    const tp = exactIntervalToTimeperiod({
      start: '2026-03-28T23:00:00Z',
      end: '2026-03-29T22:00:00Z',
    });
    expect(timeperiodsForBarchart(tp)).toHaveLength(23);
  });
});
