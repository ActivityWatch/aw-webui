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
 * Axios `requestTimeout` is 30s *per request* (`settings.ts` default). The
 * month summary used to send the whole month as one TIMEINTERVAL and the
 * client aborted on large databases. Categorize is not the cost: on 50k
 * events it is 27–116 ms in release (aw-transform, 2026-08-28).
 *
 * Measured 2026-08-28 against a live 31 MB / 4-month aw-server v0.13.2
 * (41,806 window events, no browser buckets). Query shape: flood window +
 * flood AFK + filter_period_intersect + categorize (6 rules) + merge/limit.
 *
 *   July (23,195 window events) as one TIMEINTERVAL: 0.95 s
 *   Same month as 31 sequential daily requests: 0.99 s wall, max day 0.098 s
 *   Apr–Aug as one TIMEINTERVAL: 1.79 s (query_bucket+flood is 1.64 s of that)
 *
 * Per-request time drops ~10×; total wall-clock stays comparable. Sequential
 * day requests are not extra overhead — they keep each Axios call under 30 s.
 * A 168 MB / 2y reporter DB still 30s-outs the unsplitted month view; this
 * 31 MB host does not, which is why the split matches
 * `query_category_time_by_period` rather than raising the global timeout.
 *
 * A single day stays one request. Week, month, and multi-day ranges split
 * into days. A year is also split into days: month-sized chunks are the
 * timeout. Future-starting periods are dropped so we don't query incomplete days.
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
