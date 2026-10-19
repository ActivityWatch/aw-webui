import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import 'moment/locale/de';

import {
  MAX_DAILY_BUCKETS,
  dateRangeDays,
  dateRangeToTimeperiod,
  formatDateRange,
  hourlyLabels,
  parseDateRange,
  periodStartDate,
  shiftDateRange,
  splitTimeperiodStrs,
  timeperiodsCalendarMonthsOfPeriod,
  timeperiodsForBarchart,
  timeperiodsHoursOfPeriod,
  usesMonthlyBuckets,
  timeperiodToStr,
} from '~/util/timeperiod';
import { useSettingsStore } from '~/stores/settings';

beforeEach(() => {
  setActivePinia(createPinia());
});

describe('periodStartDate', () => {
  // 2026-10-02 is a Friday.
  it.each([
    ['Monday', 'week', '2026-09-28'],
    ['Sunday', 'week', '2026-09-27'],
    ['Saturday', 'week', '2026-09-26'],
    ['Monday', 'month', '2026-10-01'],
    ['Monday', 'year', '2026-01-01'],
    ['Monday', 'day', '2026-10-02'],
  ])('with weeks starting %s, snaps to the start of the %s', (startOfWeek, period, expected) => {
    useSettingsStore().startOfWeek = startOfWeek;
    expect(periodStartDate('2026-10-02', period)).toBe(expected);
  });

  it.each([
    ['Monday', '2026-09-28'],
    ['Sunday', '2026-09-27'],
    ['Saturday', '2026-09-26'],
  ])('keeps a date that is already the start of a %s week', (startOfWeek, date) => {
    useSettingsStore().startOfWeek = startOfWeek;
    expect(periodStartDate(date, 'week')).toBe(date);
  });

  it('does not depend on the moment locale', () => {
    useSettingsStore().startOfWeek = 'Sunday';
    const previousLocale = moment.locale();
    moment.locale('de'); // weeks start on Monday in the German locale
    try {
      expect(moment.locale()).toBe('de');
      expect(periodStartDate('2026-10-02', 'week')).toBe('2026-09-27');
    } finally {
      moment.locale(previousLocale);
    }
  });
});

describe('parseDateRange', () => {
  it('parses a valid inclusive range', () => {
    expect(parseDateRange('2026-01-01..2026-03-15')).toEqual({
      start: '2026-01-01',
      end: '2026-03-15',
    });
  });

  it('accepts a single-day range', () => {
    expect(parseDateRange('2026-01-01..2026-01-01')).not.toBeNull();
  });

  it.each([
    [undefined],
    [''],
    ['2026-01-01'],
    ['2026-03-15..2026-01-01'],
    ['2026-02-30..2026-03-01'],
    ['2026-1-1..2026-2-1'],
    ['2026-01-01..2026-02-01..2026-03-01'],
  ])('rejects %p', input => {
    expect(parseDateRange(input)).toBeNull();
  });

  it('round-trips through formatDateRange', () => {
    const range = { start: '2025-12-30', end: '2026-01-02' };
    expect(parseDateRange(formatDateRange(range))).toEqual(range);
  });
});

describe('date range arithmetic', () => {
  it('counts both ends', () => {
    expect(dateRangeDays({ start: '2026-01-01', end: '2026-01-01' })).toBe(1);
    expect(dateRangeDays({ start: '2026-01-01', end: '2026-01-31' })).toBe(31);
  });

  it('shifts by the range length', () => {
    const range = { start: '2026-01-01', end: '2026-01-10' };
    expect(shiftDateRange(range, 1)).toEqual({ start: '2026-01-11', end: '2026-01-20' });
    expect(shiftDateRange(range, -1)).toEqual({ start: '2025-12-22', end: '2025-12-31' });
  });

  it('builds a day-resolution timeperiod with the day offset', () => {
    const tp = dateRangeToTimeperiod({ start: '2026-01-01', end: '2026-01-10' }, '04:00');
    expect(moment(tp.start).format('YYYY-MM-DD HH:mm')).toBe('2026-01-01 04:00');
    expect(tp.length).toEqual([10, 'days']);
  });
});

describe('timeperiodsForBarchart', () => {
  const start = moment('2026-01-15T00:00:00').format();

  it('uses hours for a single day', () => {
    expect(timeperiodsForBarchart({ start, length: [1, 'day'] })).toHaveLength(24);
  });

  it('uses days up to MAX_DAILY_BUCKETS', () => {
    expect(timeperiodsForBarchart({ start, length: [MAX_DAILY_BUCKETS, 'days'] })).toHaveLength(
      MAX_DAILY_BUCKETS
    );
  });

  it('uses clipped calendar months for longer ranges', () => {
    // 2026-01-15 .. 2026-05-14 (120 days)
    const periods = timeperiodsForBarchart({ start, length: [120, 'days'] });
    expect(periods.map(p => moment(p.start).format('YYYY-MM-DD'))).toEqual([
      '2026-01-15',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
    ]);
    expect(periods.map(p => p.length[0])).toEqual([17, 28, 31, 30, 14]);
  });

  it('keeps the day-start offset on month boundaries', () => {
    const tp = dateRangeToTimeperiod({ start: '2026-01-01', end: '2026-12-31' }, '04:00');
    const periods = timeperiodsCalendarMonthsOfPeriod(tp);
    expect(periods).toHaveLength(12);
    expect(periods.every(p => moment(p.start).format('D HH:mm') === '1 04:00')).toBe(true);
  });

  it('uses calendar months for a year, matching the chunk-derived keys', () => {
    // The Year view always starts on January 1 (periodStartDate).
    const yearStart = moment(start).startOf('year').hours(moment(start).hours()).format();
    const periods = timeperiodsForBarchart({ start: yearStart, length: [1, 'year'] });
    expect(periods).toHaveLength(12);
    expect(periods.map(timeperiodToStr)).toEqual(
      timeperiodsCalendarMonthsOfPeriod({ start: yearStart, length: [1, 'year'] }).map(
        timeperiodToStr
      )
    );
    expect(usesMonthlyBuckets({ start, length: [1, 'year'] })).toBe(true);
    expect(usesMonthlyBuckets({ start, length: [1, 'month'] })).toBe(false);
  });
});

describe('timeperiodsHoursOfPeriod', () => {
  const start = moment('2026-01-15T00:00:00').format();

  it('produces 24 one-hour periods on an ordinary day', () => {
    const periods = timeperiodsHoursOfPeriod({ start, length: [1, 'day'] });
    expect(periods).toHaveLength(24);
    expect(periods.every(p => p.length[0] === 1 && p.length[1] === 'hour')).toBe(true);
  });

  it('covers the whole interval contiguously with no gaps or overrun', () => {
    const periods = timeperiodsHoursOfPeriod({ start, length: [1, 'day'] });
    const startM = moment(start);
    const endM = startM.clone().add(1, 'day');

    expect(periods[0].start).toBe(startM.format());
    for (let i = 1; i < periods.length; i++) {
      const prev = periods[i - 1];
      const prevEnd = moment(prev.start).add(
        prev.length[0],
        prev.length[1] as moment.unitOfTime.DurationConstructor
      );
      expect(prevEnd.format()).toBe(moment(periods[i].start).format());
    }
    const last = periods[periods.length - 1];
    const lastEnd = moment(last.start).add(
      last.length[0],
      last.length[1] as moment.unitOfTime.DurationConstructor
    );
    expect(lastEnd.format()).toBe(endM.format());

    // Total elapsed time must equal the bound interval exactly.
    let total = 0;
    for (const p of periods) {
      total += moment(p.start)
        .add(p.length[0], p.length[1] as moment.unitOfTime.DurationConstructor)
        .diff(moment(p.start), 'hours', true);
    }
    expect(total).toBeCloseTo(endM.diff(startM, 'hours', true), 6);
  });

  it('does not mutate the input timeperiod', () => {
    const periodLength: [number, string] = [1, 'day'];
    const tp = { start, length: periodLength };
    const snapshot = JSON.stringify(tp);
    timeperiodsHoursOfPeriod(tp);
    expect(periodLength).toEqual([1, 'day']);
    expect(JSON.stringify(tp)).toBe(snapshot);
  });
});

describe('hourlyLabels', () => {
  const start = moment('2026-01-15T00:00:00').format();

  it('emits one label per hourly interval', () => {
    const tp = { start, length: [1, 'day'] as [number, string] };
    const labels = hourlyLabels(tp);
    expect(labels).toHaveLength(timeperiodsHoursOfPeriod(tp).length);
    // Ordinary days keep bare hours, derived from each interval's local clock.
    expect(labels).toEqual(timeperiodsHoursOfPeriod(tp).map(p => String(moment(p.start).hour())));
  });
});

describe('splitTimeperiodStrs', () => {
  it('keeps short periods as one request', () => {
    const tp = {
      start: moment('2026-01-01T00:00:00').format(),
      length: [30, 'days'] as [number, string],
    };
    expect(splitTimeperiodStrs(tp, 92)).toHaveLength(1);
  });

  it('splits long periods into contiguous chunks', () => {
    const tp = {
      start: moment('2022-01-01T00:00:00').format(),
      length: [1000, 'days'] as [number, string],
    };
    const chunks = splitTimeperiodStrs(tp, 366);
    expect(chunks).toHaveLength(3);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].split('/')[0]).toBe(chunks[i - 1].split('/')[1]);
    }
    const end = moment(tp.start).add(1000, 'days').format();
    expect(chunks[chunks.length - 1].split('/')[1]).toBe(end);
  });
});
