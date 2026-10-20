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
  if (timeperiod.length[1] === 'milliseconds') {
    return exactIntervalReadable(timeperiod);
  }
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

const WEEKDAY_INDEX = { Sunday: 0, Monday: 1, Saturday: 6 };

// Snaps a YYYY-MM-DD date to the first day of the day/week/month/year containing it.
// Weeks start on the configured start of week, independent of moment's locale.
export function periodStartDate(date: string, periodLength: string): string {
  const m = moment(date);
  if (periodLength === 'week') {
    const settingsStore = useSettingsStore();
    const weekStart = WEEKDAY_INDEX[settingsStore.startOfWeek] ?? WEEKDAY_INDEX.Monday;
    return m
      .subtract((m.day() - weekStart + 7) % 7, 'days')
      .startOf('day')
      .format('YYYY-MM-DD');
  }
  return m.startOf(periodLengthConvertMoment(periodLength)).format('YYYY-MM-DD');
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

/**
 * Hourly intervals covering `timeperiod` exactly, clipping the final interval
 * so there is never any overrun. A calendar day is not always 24 elapsed hours
 * (23/25 across DST, 23.5/24.5 with a 30-minute shift, or fractional-hour
 * starts), so step by an hour until the bound instead of assuming a count of 24.
 */
export function timeperiodsHoursOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const start = moment(timeperiod.start);
  const end = start
    .clone()
    .add(timeperiod.length[0], timeperiod.length[1] as moment.unitOfTime.DurationConstructor);
  const periods: TimePeriod[] = [];
  let cur = start.clone();
  while (cur.isBefore(end)) {
    let next = cur.clone().add(1, 'hour');
    let hours = 1;
    if (next.isAfter(end)) {
      next = end.clone();
      hours = next.diff(cur, 'hours', true);
    }
    periods.push({ start: cur.format(), length: [hours, 'hour'] });
    cur = next;
  }
  return periods;
}

/**
 * One label per interval from `timeperiodsHoursOfPeriod`, so the count matches
 * the intervals (24 normally, 23/25 across DST). Labels are bare hours, or
 * `H:mm` when a start has non-zero minutes. A repeated wall-clock label (the
 * fall-back hour) gets its UTC offset appended, e.g. `2 (+02:00)`.
 */
export function hourlyLabels(timeperiod: TimePeriod): string[] {
  const periods = timeperiodsHoursOfPeriod(timeperiod);
  const labels = periods.map(p => {
    const m = moment(p.start);
    return m.minute() === 0 ? m.format('H') : m.format('H:mm');
  });
  const counts = labels.reduce<Record<string, number>>((acc, label) => {
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});
  return periods.map((p, i) =>
    counts[labels[i]] > 1 ? `${labels[i]} (${moment(p.start).format('Z')})` : labels[i]
  );
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

/** Exact intervals up to this many elapsed milliseconds use hourly buckets. */
export const EXACT_HOURLY_MAX_MS = 24 * 3600 * 1000;

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
  if (res === 'milliseconds') {
    // Exact intervals: hours up to one elapsed day, clipped calendar days beyond
    return count <= EXACT_HOURLY_MAX_MS
      ? timeperiodsHoursOfPeriod(timeperiod)
      : timeperiodsExactDaysOfPeriod(timeperiod);
  }
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
    // Calendar months, the same keys categoryByPeriodFromChunks produces.
    return timeperiodsCalendarMonthsOfPeriod(timeperiod);
  }
  throw new Error(`Unknown timeperiod length: ${timeperiod.length}`);
}

/**
 * Whether the barchart (and category-by-period data) uses calendar-month
 * buckets: long custom ranges and the Year view. For these the per-month
 * category data is summed from the day-chunked desktop query results
 * (`categoryByPeriodFromChunks`) instead of one month-sized category request
 * per month, which took 10-38 s each on a 1.7 GB database
 * (ActivityWatch/aw-webui#1094).
 */
export function usesMonthlyBuckets(timeperiod: TimePeriod): boolean {
  const [count, res] = timeperiod.length;
  return (
    (res.startsWith('day') && count > MAX_DAILY_BUCKETS) || (res.startsWith('year') && count === 1)
  );
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

/**
 * Exact intervals are encoded in the Activity URL as one path segment,
 * `START..END`, under the `interval` period. Both ends are whole-second RFC3339
 * instants with a `Z` or numeric offset, and the interval is end-exclusive:
 * `/activity/:host/interval/2026-10-20T13:00:00Z..2026-10-20T14:00:00Z/...`
 * Unlike `range`, no start-of-day offset applies and ends are not inclusive days.
 */
export interface ExactInterval {
  start: string;
  end: string;
}

const INSTANT_RE =
  /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;
const INSTANT_FORMAT = 'YYYY-MM-DDTHH:mm:ss[Z]';
/** Exact intervals are limited to the daily-bucket budget, like date ranges. */
export const MAX_INTERVAL_MS = MAX_DAILY_BUCKETS * 24 * 3600 * 1000;

function parseInstant(str: string): moment.Moment | null {
  if (!INSTANT_RE.test(str)) return null;
  const m = moment.parseZone(str, moment.ISO_8601, true);
  // Reject impossible dates/times (e.g. 2026-02-30, 24:00, offsets beyond +-23:59)
  return m.isValid() ? m : null;
}

export function formatInstant(instant: string | moment.Moment): string {
  return moment.utc(instant).format(INSTANT_FORMAT);
}

/**
 * Parse a `START..END` segment. Returns null for anything but two valid
 * offset-bearing whole-second instants with `end > start` and a span within
 * MAX_INTERVAL_MS, so that an invalid segment can never reach a query.
 * Bounds are returned in canonical UTC form.
 */
export function parseExactInterval(str: string | undefined | null): ExactInterval | null {
  if (!str) return null;
  const parts = str.split(DATE_RANGE_SEP);
  if (parts.length !== 2) return null;
  const start = parseInstant(parts[0]);
  const end = parseInstant(parts[1]);
  if (!start || !end) return null;
  const span = end.valueOf() - start.valueOf();
  if (span <= 0 || span > MAX_INTERVAL_MS) return null;
  return { start: formatInstant(start), end: formatInstant(end) };
}

export function formatExactInterval(interval: ExactInterval): string {
  return `${interval.start}${DATE_RANGE_SEP}${interval.end}`;
}

/** The elapsed interval as a TimePeriod, so existing query code applies as-is. */
export function exactIntervalToTimeperiod(interval: ExactInterval): TimePeriod {
  const start = moment(interval.start);
  return {
    start: start.format(),
    length: [moment(interval.end).valueOf() - start.valueOf(), 'milliseconds'],
  };
}

/** Shift both bounds by the elapsed duration (direction -1 = previous, +1 = next). */
export function shiftExactInterval(interval: ExactInterval, direction: number): ExactInterval {
  const span = moment(interval.end).valueOf() - moment(interval.start).valueOf();
  return {
    start: formatInstant(moment(interval.start).add(direction * span, 'milliseconds')),
    end: formatInstant(moment(interval.end).add(direction * span, 'milliseconds')),
  };
}

/** Whether a TimePeriod is an exact elapsed interval (as opposed to calendar units). */
export function isExactTimeperiod(timeperiod: TimePeriod): boolean {
  return timeperiod.length[1] === 'milliseconds';
}

const WALL_FORMAT = 'YYYY-MM-DDTHH:mm';

/**
 * UTC instants a local wall time (`YYYY-MM-DDTHH:mm`) can mean in the browser's
 * zone: none in a spring-forward gap, one normally, two for the repeated hour
 * when clocks go back. Callers must not silently pick an occurrence.
 */
export function wallTimeInstants(wall: string): string[] {
  const naive = moment.utc(wall, WALL_FORMAT, true);
  if (!naive.isValid()) return [];
  const local = moment(wall, WALL_FORMAT, true);
  const offsets = new Set<number>();
  for (let h = -3; h <= 3; h++) offsets.add(local.clone().add(h, 'hours').utcOffset());
  const found: string[] = [];
  offsets.forEach(offset => {
    const instant = naive.clone().subtract(offset, 'minutes');
    // Only offsets that really apply at that instant produce this wall time
    if (moment(instant.valueOf()).format(WALL_FORMAT) === wall) found.push(formatInstant(instant));
  });
  return found.sort();
}

/** Local wall time (`YYYY-MM-DDTHH:mm`) of an instant, for datetime-local inputs. */
export function instantToWall(instant: string): string {
  return moment(instant).format(WALL_FORMAT);
}

/**
 * Human-readable label for an exact interval: local date and time, with the
 * end date shown only when it differs. Never reads as a date-only day.
 */
export function exactIntervalReadable(timeperiod: TimePeriod): string {
  const start = moment(timeperiod.start);
  const end = start.clone().add(timeperiod.length[0], 'milliseconds');
  const sameDay = start.format('YYYY-MM-DD') === end.format('YYYY-MM-DD');
  const fmt = (m: moment.Moment, withDate: boolean) =>
    m.format(withDate ? 'YYYY-MM-DD HH:mm:ss Z' : 'HH:mm:ss Z');
  return `${fmt(start, true)} — ${fmt(end, !sameDay)}`;
}

/**
 * Hourly buckets for an exact interval up to one elapsed day are produced by
 * timeperiodsHoursOfPeriod; longer ones are cut into calendar-day chunks from
 * the start instant, with the final chunk clipped to the end bound.
 */
export function timeperiodsExactDaysOfPeriod(timeperiod: TimePeriod): TimePeriod[] {
  const start = moment(timeperiod.start);
  const end = start.clone().add(timeperiod.length[0], 'milliseconds');
  const periods: TimePeriod[] = [];
  let cur = start.clone();
  while (cur.isBefore(end)) {
    let next = cur.clone().add(1, 'day');
    let bucketLength: [number, string] = [1, 'day'];
    if (next.isAfter(end)) {
      next = end.clone();
      bucketLength = [next.valueOf() - cur.valueOf(), 'milliseconds'];
    }
    periods.push({ start: cur.format(), length: bucketLength });
    cur = next;
  }
  return periods;
}

/**
 * One label per bucket of `timeperiodsForBarchart` for an exact interval:
 * hour labels up to a day (repeated fall-back hours carry their offset), the
 * chunk start date (and time when not midnight) for longer intervals.
 */
export function exactBucketLabels(timeperiod: TimePeriod): string[] {
  if (timeperiod.length[0] <= EXACT_HOURLY_MAX_MS) return hourlyLabels(timeperiod);
  return timeperiodsExactDaysOfPeriod(timeperiod).map(p => {
    const m = moment(p.start);
    return m.format(m.hours() === 0 && m.minutes() === 0 ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm');
  });
}
