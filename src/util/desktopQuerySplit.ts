import moment from 'moment';

import { default_limit as DESKTOP_QUERY_EVENT_LIMIT } from '~/queries';
import { IEvent } from '~/util/interfaces';
import { TimePeriod, timeperiodToStr, timeperiodsDaysOfPeriod } from '~/util/timeperiod';

export { DESKTOP_QUERY_EVENT_LIMIT };

export interface WindowQueryResult {
  app_events?: IEvent[];
  title_events?: IEvent[];
  cat_events?: IEvent[];
  active_events?: IEvent[];
  duration?: number;
}

export interface BrowserQueryResult {
  domains?: IEvent[];
  urls?: IEvent[];
  titles?: IEvent[];
  duration?: number;
}

export interface StopwatchQueryResult {
  stopwatch_events?: IEvent[];
}

export interface FullDesktopQueryResult {
  window?: WindowQueryResult;
  browser?: BrowserQueryResult;
  stopwatch?: StopwatchQueryResult;
}

/**
 * Periods for `fullDesktopQuery` / `multideviceQuery`.
 *
 * A single day stays one request (day view is already under the 30s budget).
 * Week, month, and multi-day ranges split into days — the same shape
 * `query_category_time_by_period` uses to avoid timeout on slow queries.
 * A year is also split into days: month-sized chunks are the timeout.
 *
 * Future-starting periods are dropped so we don't query incomplete days.
 */
export function periodsForFullDesktopQuery(
  timeperiod: TimePeriod,
  now: Date = new Date()
): string[] {
  const [count, res] = timeperiod.length;
  let periods: string[];

  if (res.startsWith('day') && count === 1) {
    periods = [timeperiodToStr(timeperiod)];
  } else if (
    res.startsWith('day') ||
    (res.startsWith('week') && count === 1) ||
    (res.startsWith('month') && count === 1)
  ) {
    periods = timeperiodsDaysOfPeriod(timeperiod).map(timeperiodToStr);
  } else if (res.startsWith('year') && count === 1) {
    const start = moment(timeperiod.start);
    const end = start.clone().add(1, 'year');
    periods = [];
    for (let d = start.clone(); d.isBefore(end); d.add(1, 'day')) {
      periods.push(timeperiodToStr({ start: d.format(), length: [1, 'day'] }));
    }
  } else {
    periods = [timeperiodToStr(timeperiod)];
  }

  return periods.filter(period => new Date(period.split('/')[0]) < now);
}

export function mergeEventsByKeys(events: IEvent[], keys: string[], limit?: number): IEvent[] {
  const groups = new Map<string, IEvent>();
  for (const event of events) {
    if (!event) continue;
    const groupKey = keys.map(k => JSON.stringify(event.data?.[k])).join('\0');
    const existing = groups.get(groupKey);
    const duration = event.duration || 0;
    if (!existing) {
      groups.set(groupKey, {
        timestamp: event.timestamp,
        duration,
        data: { ...event.data },
      });
    } else {
      existing.duration += duration;
      if (event.timestamp && existing.timestamp && event.timestamp < existing.timestamp) {
        existing.timestamp = event.timestamp;
      }
    }
  }
  const merged = Array.from(groups.values()).sort((a, b) => b.duration - a.duration);
  return limit === undefined ? merged : merged.slice(0, limit);
}

function concatEvents(chunks: Array<IEvent[] | undefined>): IEvent[] {
  const out: IEvent[] = [];
  for (const chunk of chunks) {
    if (chunk) out.push(...chunk);
  }
  return out;
}

function sumDurations(values: Array<number | undefined>): number {
  return values.reduce((acc: number, value) => acc + (value || 0), 0);
}

export function mergeFullDesktopResults(results: FullDesktopQueryResult[]): FullDesktopQueryResult {
  const windows = results.map(r => r.window).filter(Boolean) as WindowQueryResult[];
  const browsers = results.map(r => r.browser).filter(Boolean) as BrowserQueryResult[];
  const stopwatches = results.map(r => r.stopwatch).filter(Boolean) as StopwatchQueryResult[];

  return {
    window: {
      app_events: mergeEventsByKeys(
        concatEvents(windows.map(w => w.app_events)),
        ['app'],
        DESKTOP_QUERY_EVENT_LIMIT
      ),
      title_events: mergeEventsByKeys(
        concatEvents(windows.map(w => w.title_events)),
        ['app', 'title'],
        DESKTOP_QUERY_EVENT_LIMIT
      ),
      // cat_events is not limit_events'd in fullDesktopQuery
      cat_events: mergeEventsByKeys(concatEvents(windows.map(w => w.cat_events)), ['$category']),
      active_events: concatEvents(windows.map(w => w.active_events)),
      duration: sumDurations(windows.map(w => w.duration)),
    },
    browser: {
      domains: mergeEventsByKeys(
        concatEvents(browsers.map(b => b.domains)),
        ['$domain'],
        DESKTOP_QUERY_EVENT_LIMIT
      ),
      urls: mergeEventsByKeys(
        concatEvents(browsers.map(b => b.urls)),
        ['url'],
        DESKTOP_QUERY_EVENT_LIMIT
      ),
      titles: mergeEventsByKeys(
        concatEvents(browsers.map(b => b.titles)),
        ['title'],
        DESKTOP_QUERY_EVENT_LIMIT
      ),
      duration: sumDurations(browsers.map(b => b.duration)),
    },
    stopwatch: {
      stopwatch_events: mergeEventsByKeys(
        concatEvents(stopwatches.map(s => s.stopwatch_events)),
        ['label'],
        DESKTOP_QUERY_EVENT_LIMIT
      ),
    },
  };
}
