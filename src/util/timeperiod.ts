import moment from 'moment';
import { get_day_start_with_offset } from './time';
import { useSettingsStore } from '~/stores/settings';

export interface TimePeriod {
  start: string;
  length: [number, string];
}

export function dateToTimeperiod(
  date: string,
  offset: string,
  duration?: [number, string]
): TimePeriod {
  return { start: get_day_start_with_offset(date, offset), length: duration || [1, 'day'] };
}

export function timeperiodToStr(tp: TimePeriod): string {
  const start = moment(tp.start).format();
  const end = moment(start)
    .add(tp.length[0], tp.length[1] as moment.unitOfTime.DurationConstructor)
    .format();
  return [start, end].join('/');
}

export function dateformat(periodLength: string) {
  if (periodLength === 'day') {
    return 'YYYY-MM-DD';
  } else if (periodLength === 'week') {
    return 'YYYY[ W]WW';
  } else if (periodLength === 'month') {
    return 'YYYY-MM';
  } else if (periodLength === 'year') {
    return 'YYYY';
  } else {
    return 'YYYY-MM-DD';
  }
}

export function periodReadable(timeperiod: TimePeriod) {
  if (timeperiod.length[0] === 1) {
    return moment(timeperiod.start).format(dateformat(timeperiod.length[1]));
  } else {
    return (
      moment(timeperiod.start).format(dateformat(timeperiod.length[1])) +
      ' to ' +
      moment(timeperiod.start)
        .add(timeperiod.length[0], timeperiod.length[1] as moment.unitOfTime.DurationConstructor)
        .format(dateformat(timeperiod.length[1]))
    );
  }
}

export function periodLengthConvertMoment(periodLength: string) {
  const settingsStore = useSettingsStore();
  if (periodLength === 'day') {
    return 'day';
  } else if (periodLength === 'week') {
    /* This is necessary so the week starts on Monday instead of Sunday */
    return settingsStore.startOfWeek == 'Monday' ? 'isoWeek' : 'week';
  } else if (periodLength === 'month') {
    return 'month';
  } else if (periodLength === 'year') {
    return 'year';
  } else {
    console.error(`Invalid periodLength ${periodLength}, defaulting to "day"`);
    return 'day';
  }
}

export function timeperiodsAroundTimeperiod(timeperiod: TimePeriod): TimePeriod[] {
  const periods = [];
  for (let i = -15; i <= 15; i++) {
    const start = moment(timeperiod.start)
      .add(i * timeperiod.length[0], timeperiod.length[1] as moment.unitOfTime.DurationConstructor)
      .format();
    periods.push({ ...timeperiod, start });
  }
  return periods;
}

export function timeperiodsHoursOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const periods = [];
  const _length: [number, string] = [1, 'hour'];
  for (let i = 0; i < 24; i++) {
    const start = moment(timeperiod.start)
      .add(i * _length[0], _length[1] as moment.unitOfTime.DurationConstructor)
      .format();
    periods.push({ start, length: _length });
  }
  return periods;
}

export function timeperiodsDaysOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const periods = [];
  const _length: [number, string] = [1, 'day'];

  let count: number;
  if (timeperiod.length[1].startsWith('day')) {
    count = timeperiod.length[0];
  } else if (timeperiod.length[1].startsWith('week')) {
    count = 7;
  } else if (timeperiod.length[1].startsWith('month')) {
    count = moment(timeperiod.start).daysInMonth();
  } else {
    throw new Error(`Invalid periodLength ${timeperiod.length[1]}`);
  }

  for (let i = 0; i < count; i++) {
    const start = moment(timeperiod.start)
      .add(i * _length[0], _length[1] as moment.unitOfTime.DurationConstructor)
      .format();
    periods.push({ start, length: _length });
  }
  return periods;
}

export function timeperiodsMonthsOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const periods = [];
  const _length: [number, string] = [1, 'month'];

  const count = 12;
  for (let i = 0; i < count; i++) {
    const start = moment(timeperiod.start)
      .add(i * _length[0], _length[1] as moment.unitOfTime.DurationConstructor)
      .format();
    periods.push({ start, length: _length });
  }
  return periods;
}

/**
 * Custom date ranges are encoded in the Activity URL as a single path segment,
 * `YYYY-MM-DD..YYYY-MM-DD` (both ends inclusive), under the `range` period:
 * `/activity/:host/range/2026-01-01..2026-03-15/view/...`
 */
export interface DateRange {
  start: string;
  end: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const DATE_RANGE_SEP = '..';

export function parseDateRange(str: string | undefined | null): DateRange | null {
  if (!str) return null;
  const parts = str.split(DATE_RANGE_SEP);
  if (parts.length !== 2) return null;
  const [start, end] = parts;
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) return null;
  const mStart = moment(start, 'YYYY-MM-DD', true);
  const mEnd = moment(end, 'YYYY-MM-DD', true);
  if (!mStart.isValid() || !mEnd.isValid() || mEnd.isBefore(mStart)) return null;
  return { start, end };
}

export function formatDateRange(range: DateRange): string {
  return `${range.start}${DATE_RANGE_SEP}${range.end}`;
}

/** Number of days in the range, counting both ends. */
export function dateRangeDays(range: DateRange): number {
  return moment(range.end).diff(moment(range.start), 'days') + 1;
}

/** Shift a range by its own length (direction -1 = previous, +1 = next). */
export function shiftDateRange(range: DateRange, direction: number): DateRange {
  const days = dateRangeDays(range) * direction;
  return {
    start: moment(range.start).add(days, 'days').format('YYYY-MM-DD'),
    end: moment(range.end).add(days, 'days').format('YYYY-MM-DD'),
  };
}

export function dateRangeToTimeperiod(range: DateRange, offset: string): TimePeriod {
  return {
    start: get_day_start_with_offset(range.start, offset),
    length: [dateRangeDays(range), 'days'],
  };
}

/**
 * Multi-day ranges longer than this are bucketed by calendar month instead of
 * by day, both for the timeline barchart and for the per-period category query.
 * 92 days keeps a full quarter at day resolution.
 */
export const MAX_DAILY_BUCKETS = 92;

/**
 * Calendar-month periods covering `timeperiod`, with the first and last month
 * clipped to the period bounds.
 */
export function timeperiodsCalendarMonthsOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const start = moment(timeperiod.start);
  const end = start
    .clone()
    .add(timeperiod.length[0], timeperiod.length[1] as moment.unitOfTime.DurationConstructor);
  const periods: TimePeriod[] = [];
  let cur = start.clone();
  while (cur.isBefore(end)) {
    let next = cur.clone().startOf('month').add(1, 'month');
    // Keep the day-start offset (e.g. 04:00) on month boundaries
    next = next.hours(start.hours()).minutes(start.minutes());
    if (next.isAfter(end)) next = end.clone();
    const days = next.diff(cur, 'days', true);
    periods.push({ start: cur.format(), length: [Math.round(days), 'days'] });
    cur = next;
  }
  return periods;
}

/**
 * Periods for the timeline barchart (and the category-by-period query feeding it):
 * hours for a single day, days for weeks/months/multi-day ranges up to
 * MAX_DAILY_BUCKETS, months for a year and for longer ranges.
 */
export function timeperiodsForBarchart(timeperiod: TimePeriod): TimePeriod[] {
  const [count, res] = timeperiod.length;
  if (res.startsWith('day') && count === 1) {
    return timeperiodsHoursOfPeriod(timeperiod);
  } else if (res.startsWith('day') && count > MAX_DAILY_BUCKETS) {
    return timeperiodsCalendarMonthsOfPeriod(timeperiod);
  } else if (
    res.startsWith('day') ||
    (res.startsWith('week') && count === 1) ||
    (res.startsWith('month') && count === 1)
  ) {
    return timeperiodsDaysOfPeriod(timeperiod);
  } else if (res.startsWith('year') && count === 1) {
    return timeperiodsMonthsOfPeriod(timeperiod);
  }
  throw new Error(`Unknown timeperiod length: ${timeperiod.length}`);
}

/** Whether the barchart (and category-by-period data) uses calendar-month buckets. */
export function usesMonthlyBuckets(timeperiod: TimePeriod): boolean {
  const [count, res] = timeperiod.length;
  return res.startsWith('day') && count > MAX_DAILY_BUCKETS;
}

/**
 * Split a timeperiod into consecutive period strings of at most `maxDays` each.
 * Used for queries that return a single aggregate per request (editor, Android)
 * so that very long ranges (e.g. All time) don't exceed the request timeout.
 */
export function splitTimeperiodStrs(timeperiod: TimePeriod, maxDays: number): string[] {
  const start = moment(timeperiod.start);
  const end = start
    .clone()
    .add(timeperiod.length[0], timeperiod.length[1] as moment.unitOfTime.DurationConstructor);
  const periods: string[] = [];
  let cur = start.clone();
  while (cur.isBefore(end)) {
    let next = cur.clone().add(maxDays, 'days');
    if (next.isAfter(end)) next = end.clone();
    periods.push([cur.format(), next.format()].join('/'));
    cur = next;
  }
  return periods;
}
