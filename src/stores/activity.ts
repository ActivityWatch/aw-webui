import { defineStore } from 'pinia';
import moment from 'moment';
import * as _ from 'lodash';
import { map, filter, values, groupBy, sortBy, flow, reverse } from 'lodash/fp';
import { IEvent } from '~/util/interfaces';

import { window_events } from '~/util/fakedata';
import queries, { MultiQueryParams } from '~/queries';
import { get_day_start_with_offset, get_offset_duration } from '~/util/time';
import {
  TimePeriod,
  dateToTimeperiod,
  timeperiodToStr,
  splitTimeperiodStrs,
  timeperiodsAroundTimeperiod,
  timeperiodsForBarchart,
  usesMonthlyBuckets,
} from '~/util/timeperiod';
import { earliestEventInBuckets } from '~/util/earliestEvent';

import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';

import { getClient } from '~/util/awclient';
import {
  buildMultideviceHostParams,
  eligibleMultideviceHosts,
  isMultiHostSelection,
  parseHostParam,
  resolveHostSelection,
} from '~/util/multidevice';
import {
  DESKTOP_QUERY_EVENT_LIMIT,
  FullDesktopQueryResult,
  categoryByPeriodFromChunks,
  mergeEventsByKeys,
  mergeFullDesktopResults,
  periodsForFullDesktopQuery,
} from '~/util/desktopQuerySplit';

function timeperiodStrsAroundTimeperiod(timeperiod: TimePeriod): string[] {
  return timeperiodsAroundTimeperiod(timeperiod).map(timeperiodToStr);
}

function colorCategories(events: IEvent[]): IEvent[] {
  // Set $color for categories
  const categoryStore = useCategoryStore();
  return events.map((e: IEvent) => {
    e.data['$color'] = categoryStore.get_category_color(e.data['$category']);
    return e;
  });
}

function scoreCategories(events: IEvent[]): IEvent[] {
  // Set $score for categories
  const categoryStore = useCategoryStore();
  return events.map((e: IEvent) => {
    e.data['$score'] = categoryStore.get_category_score(e.data['$category']);
    return e;
  });
}

/**
 * One day at a time, same reason as query_category_time_by_period.
 * Axios timeout is per request (default 30s). Measured 2026-08-28 on a
 * 31 MB / 4-month aw-server: July as one TIMEINTERVAL 0.95s vs max daily
 * 0.098s; 31-day sequential wall 0.99s. See desktopQuerySplit.ts.
 */
async function queryDesktopPeriods(
  periods: string[],
  query: string[],
  name: string,
  onProgress?: () => void
): Promise<{ merged: FullDesktopQueryResult; chunks: [string, FullDesktopQueryResult][] }> {
  const client = getClient();
  const signal = client.controller.signal;
  const chunks: [string, FullDesktopQueryResult][] = [];
  for (const period of periods) {
    if (signal.aborted) {
      throw signal['reason'] || 'unknown reason';
    }
    const data = await client.query([period], query, { name, verbose: true });
    if (data && data[0]) {
      chunks.push([period, data[0]]);
    }
    if (onProgress) onProgress();
  }
  return { merged: mergeFullDesktopResults(chunks.map(([, r]) => r)), chunks };
}

/**
 * Group period strings so each request covers at most `maxDays` in total.
 * Active history for a year of AFK events takes ~6-8s on aw-server; all 16
 * years around a Year view in one request took 37s (erb-m2, 2026-09-26),
 * past the 30s request timeout. Day/Week views still fit in one request.
 */
export function chunkPeriodsBySpan(periods: string[], maxDays = 366): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let span = 0;
  for (const period of periods) {
    const [start, end] = period.split('/');
    const days = moment(end).diff(moment(start), 'days', true);
    if (current.length > 0 && span + days > maxDays) {
      chunks.push(current);
      current = [];
      span = 0;
    }
    current.push(period);
    span += days;
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks;
}

/** Bundle ID -> app name, from ScreenTime events (app = bundle ID, title = name). */
export function screentimeNameMap(events: IEvent[]): Record<string, string> {
  const names: Record<string, string> = {};
  events.forEach(e => {
    if (e.data.title && !names[e.data.app]) {
      names[e.data.app] = e.data.title;
    }
  });
  return names;
}

/**
 * Attach each app's dominant category (by duration) as `$category`, so Top
 * Applications can color an app by what it was used for. Matching the app name
 * against the category rules doesn't work for apps whose activity is
 * categorized by title or URL, such as browsers, which were always shown as
 * Uncategorized. Apps without app_cat_events keep their old (name-based) color.
 */
export function withDominantCategory(appEvents: IEvent[], appCatEvents?: IEvent[]): IEvent[] {
  if (!appEvents || !appCatEvents || appCatEvents.length === 0) return appEvents;
  // ScreenTime remaps set classname to the bundle ID on both lists, so two
  // bundle IDs that share a display name are kept apart.
  const appKey = (e: IEvent): string => e.data.classname ?? e.data.app;
  const dominant = new Map<string, { duration: number; category: string[] }>();
  for (const e of appCatEvents) {
    const best = dominant.get(appKey(e));
    if (!best || e.duration > best.duration) {
      dominant.set(appKey(e), { duration: e.duration, category: e.data.$category });
    }
  }
  return appEvents.map(e => {
    const best = dominant.get(appKey(e));
    return best ? { ...e, data: { ...e.data, $category: best.category } } : e;
  });
}

/** Show ScreenTime apps by name, keeping the bundle ID as classname (in place). */
export function applyScreentimeNames(events: IEvent[], bundleIdToName: Record<string, string>) {
  events.forEach(e => {
    const name = bundleIdToName[e.data.app];
    if (name) {
      e.data.classname = e.data.app;
      e.data.app = name;
    }
  });
}

/**
 * Periods around `timeperiod` whose active history still needs querying:
 * not started yet periods are skipped, cached ones are reused, except the
 * period containing now, which is still growing.
 */
export function uncachedHistoryPeriods(
  periods: string[],
  cachedHistory: Record<string, unknown>,
  now: Date = new Date()
): string[] {
  return periods.filter(tp_str => {
    const [start, end] = tp_str.split('/').map(t => new Date(t));
    if (start >= now) return false;
    return !_.has(cachedHistory, tp_str) || end > now;
  });
}

// Max days per request for queries returning one aggregate for the whole
// period (editor, Android). Only long periods (e.g. All time) get split.
const EDITOR_MAX_DAYS_PER_REQUEST = 366;
const ANDROID_MAX_DAYS_PER_REQUEST = 92;

// Per-chunk limit when a query is split: items outside one chunk's top 100
// can still be in the overall top 100 once summed, so over-fetch and cut
// after merging.
const CHUNKED_QUERY_LIMIT = 1000;

// hosts/day start/buckets -> first day with data (YYYY-MM-DD), see get_earliest_date
const earliestDateCache = new Map<string, string | null>();

function sumDurations(results: { duration?: number }[]): number {
  return results.reduce((acc, r) => acc + (r.duration || 0), 0);
}

export function mergeEditorResults(results: Record<string, any>[]) {
  const all = (key: string): IEvent[] => _.flatten(results.map(r => r[key] || []));
  return {
    files: mergeEventsByKeys(all('files'), ['file', 'language'], DESKTOP_QUERY_EVENT_LIMIT),
    languages: mergeEventsByKeys(all('languages'), ['language'], DESKTOP_QUERY_EVENT_LIMIT),
    projects: mergeEventsByKeys(all('projects'), ['project'], DESKTOP_QUERY_EVENT_LIMIT),
    duration: sumDurations(results),
  };
}

export function mergeAppQueryResults(results: Record<string, any>[], isIos: boolean) {
  if (results.length === 1) return results[0];
  const all = (key: string): IEvent[] => _.flatten(results.map(r => r[key] || []));
  const titleKeys = isIos ? ['app', 'classname', 'title'] : ['app', 'classname'];
  const app_events = mergeEventsByKeys(all('app_events'), ['app'], DESKTOP_QUERY_EVENT_LIMIT);
  return {
    app_events,
    app_cat_events: mergeEventsByKeys(all('app_cat_events'), ['app', '$category']),
    title_events: mergeEventsByKeys(all('title_events'), titleKeys, DESKTOP_QUERY_EVENT_LIMIT),
    cat_events: mergeEventsByKeys(all('cat_events'), ['$category']),
    duration: sumDurations(results),
    active_events: app_events,
  };
}

export interface QueryOptions {
  host: string;
  date?: string;
  timeperiod?: TimePeriod;
  filter_afk?: boolean;
  include_audible?: boolean;
  include_stopwatch?: boolean;
  filter_categories?: string[][];
  dont_query_inactive?: boolean;
  // Skip the active-time history around the period (the period-usage bars),
  // e.g. for custom ranges and All time where neighbouring periods aren't shown.
  skip_active_history?: boolean;
  // The period is All time: visualizations that query a bucket outside the
  // host's standard buckets (Top Bucket Data) widen their start to that
  // bucket's own earliest event, since `timeperiod` only covers the standard ones.
  all_time?: boolean;
  force?: boolean;
  always_active_pattern?: string;
}

interface State {
  loaded: boolean;

  window: {
    available: boolean;
    top_apps: IEvent[];
    top_titles: IEvent[];
  };

  browser: {
    available: boolean;
    duration: number;
    top_urls: IEvent[];
    top_domains: IEvent[];
    top_titles: IEvent[];
  };

  editor: {
    available: boolean;
    duration: number;
    top_files: IEvent[];
    top_projects: IEvent[];
    top_languages: IEvent[];
  };

  category: {
    available: boolean;
    by_period: IEvent[];
    top: IEvent[];
  };

  active: {
    available: boolean;
    duration: number;
    // non-afk events (no detail data) for the current period
    events: IEvent[];
    // Aggregated events for current and past periods
    history: Record<any, IEvent[]>;
    // The devices/buckets the cached history was computed from
    history_key?: string;
  };

  android: {
    available: boolean;
  };

  ios: {
    available: boolean;
  };

  stopwatch: {
    available: boolean;
    top_stopwatches: IEvent[];
  };

  query_options?: QueryOptions;

  // Hosts included in the current query: a single host, or several when the
  // route selects multiple devices / "all devices" (see util/multidevice.ts).
  query_hosts: string[];
  // Request progress while loading, for long periods (All time). null when idle.
  progress: { done: number; total: number } | null;

  // Can't this be handled in bucketStore?
  buckets: {
    loaded: boolean;
    afk: string[];
    window: string[];
    editor: string[];
    browser: string[];
    android: string[];
    stopwatch: string[];
  };
}

export const useActivityStore = defineStore('activity', {
  // initial state
  state: (): State => ({
    // set to true once loading has started
    loaded: false,

    window: {
      available: false,
      top_apps: [],
      top_titles: [],
    },

    browser: {
      available: false,
      duration: 0,
      top_domains: [],
      top_urls: [],
      top_titles: [],
    },

    editor: {
      available: false,
      duration: 0,
      top_files: [],
      top_languages: [],
      top_projects: [],
    },

    category: {
      available: false,
      by_period: [],
      top: [],
    },

    active: {
      available: false,
      duration: 0,
      // non-afk events (no detail data) for the current period
      events: [],
      // Aggregated events for current and past periods
      history: {},
      history_key: undefined,
    },

    android: {
      available: false,
    },

    ios: {
      available: false,
    },

    stopwatch: {
      available: false,
      top_stopwatches: [],
    },

    query_options: null,
    query_hosts: [],
    progress: null,

    buckets: {
      loaded: false,
      afk: [],
      window: [],
      editor: [],
      browser: [],
      android: [],
      stopwatch: [],
    },
  }),

  getters: {
    getActiveHistoryAroundTimeperiod(this: State) {
      return (timeperiod: TimePeriod): IEvent[][] => {
        const periods = timeperiodStrsAroundTimeperiod(timeperiod);
        const _history = periods.map(tp => {
          if (_.has(this.active.history, tp)) {
            return this.active.history[tp];
          } else {
            // A zero-duration placeholder until new data has been fetched
            return [{ timestamp: moment(tp.split('/')[0]).format(), duration: 0, data: {} }];
          }
        });
        return _history;
      };
    },
    uncategorizedDuration(this: State): [number, number] | null {
      // Returns the uncategorized duration and the total duration
      if (!this.category.top) {
        return null;
      }
      const uncategorized = this.category.top.filter(e => {
        return _.isEqual(e.data['$category'], ['Uncategorized']);
      });
      const uncategorized_duration = uncategorized.length > 0 ? uncategorized[0].duration : 0;
      const total_duration = this.category.top.reduce((acc, e) => {
        return acc + e.duration;
      }, 0);
      return [uncategorized_duration, total_duration];
    },
  },

  actions: {
    async ensure_loaded(query_options: QueryOptions) {
      await useSettingsStore().ensureLoaded();

      console.info('Query options: ', query_options);
      if (this.loaded) {
        getClient().abort();
      }
      if (!this.loaded || this.query_options !== query_options || query_options.force) {
        try {
          await this.load(query_options);
        } finally {
          // Also when a query fails, so the progress bar doesn't get stuck.
          // Not when a newer load has taken over (its progress is still live).
          if (this.query_options === query_options) {
            this.progress = null;
          }
        }
      } else {
        console.warn(
          'ensure_loaded called twice with same query_options but without query_options.force = true, skipping...'
        );
      }
    },

    async load(query_options: QueryOptions) {
      const settingsStore = useSettingsStore();
      const bucketsStore = useBucketsStore();
      this.start_loading(query_options);
      if (!query_options.timeperiod) {
        query_options.timeperiod = dateToTimeperiod(query_options.date, settingsStore.startOfDay);
      }

      await bucketsStore.ensureLoaded();

      // The `host` option is the Activity route's `:host` param: a single
      // hostname, a comma-separated list, or "@all" (see util/multidevice.ts).
      const multiHosts = this.resolve_multidevice_hosts(query_options.host);
      if (multiHosts.length > 1) {
        await this.ensure_loaded_multidevice(query_options, multiHosts);
        return;
      }
      // A selection that resolves to a single device (e.g. "all devices"
      // when only one host has data) uses the full single-device view.
      if (multiHosts.length === 1) {
        query_options = { ...query_options, host: multiHosts[0] };
      }
      this.query_hosts = [query_options.host];

      await this.get_buckets(query_options);
      this.set_history_key();

      // TODO: These queries can actually run in parallel, but since server won't process them in parallel anyway we won't.
      this.set_available();

      if (this.window.available) {
        await this.query_desktop_full(query_options);
      } else if (this.android.available) {
        await this.query_android(query_options);
        // Android hosts may also have browser buckets from aw-watcher-web.
        if (this.browser.available) {
          await this.query_browser_only(query_options);
        }
      } else if (this.browser.available) {
        // Browser-only mode: device with aw-watcher-web but no window/afk/android watcher.
        await this.query_browser_only(query_options);
        this.query_window_completed();
        this.query_category_time_by_period_completed();
      } else {
        console.log(
          'Cannot query windows as we are missing either an afk/window bucket pair or an android bucket'
        );
        this.query_window_completed();
        this.query_category_time_by_period_completed();
      }

      if (query_options.skip_active_history) {
        // Period-usage bars not shown
      } else if (this.active.available) {
        await this.query_active_history(query_options);
      } else if (this.android.available) {
        await this.query_active_history_android(query_options);
      } else {
        console.log('Cannot call query_active_history as we do not have an afk bucket');
        await this.query_active_history_completed();
      }

      if (this.editor.available) {
        await this.query_editor(query_options);
      } else {
        console.log('Cannot call query_editor as we do not have any editor buckets');
        await this.query_editor_completed();
      }

      // Perform this last, as it takes the longest.
      // Skipped when query_desktop_full already derived it (long ranges).
      const derivedByPeriod = this.window.available && usesMonthlyBuckets(query_options.timeperiod);
      if ((this.window.available || this.android.available) && !derivedByPeriod) {
        await this.query_category_time_by_period(query_options);
      }
    },

    /**
     * Hosts to include when the `host` param selects several devices.
     * Returns [] for a plain single-host param (the regular single-device
     * path), and the resolved host list otherwise.
     */
    resolve_multidevice_hosts(host: string): string[] {
      const bucketsStore = useBucketsStore();
      const selection = parseHostParam(host, bucketsStore.hosts);
      if (!isMultiHostSelection(selection)) {
        return [];
      }
      const eligible = eligibleMultideviceHosts(
        bucketsStore.hosts,
        bucketsStore.bucketsWindow,
        bucketsStore.bucketsAFK,
        bucketsStore.bucketsAndroid,
        // fakedata hosts only take part when explicitly selected
        { includeFakedata: selection.hosts.some(h => h.startsWith('fakedata')) }
      );
      return resolveHostSelection(selection, eligible);
    },

    async ensure_loaded_multidevice(query_options: QueryOptions, hosts: string[]) {
      console.info('Querying multiple devices: ', hosts);
      this.query_hosts = hosts;
      this.get_buckets_multidevice(hosts);
      this.set_history_key();

      // The multidevice query supports window/app, category and active-time
      // data. Browser (and audible-as-active) and stopwatch data are
      // single-device only for now: browser buckets often have no usable
      // hostname, so they can't be attributed to a device.
      // With only mobile hosts selected, behave like the single-device
      // Android view: their events have no window titles.
      const bucketsStore = useBucketsStore();
      const hasDesktop = hosts.some(
        h => bucketsStore.bucketsWindow(h).length > 0 && bucketsStore.bucketsAFK(h).length > 0
      );
      this.window.available = hasDesktop;
      this.browser.available = false;
      this.active.available = true;
      this.editor.available = this.buckets.editor.length > 0;
      this.android.available = !hasDesktop;
      this.ios.available = false;
      this.category.available = true;
      this.stopwatch.available = false;

      await this.query_multidevice_full(query_options, hosts);
      if (!query_options.skip_active_history) {
        // Period-usage bars (not shown for custom ranges and All time)
        await this.query_active_history_multidevice(query_options, hosts);
      }
      if (this.editor.available) {
        await this.query_editor(query_options);
      } else {
        await this.query_editor_completed();
      }
      // Long ranges derive it from the chunk results in query_multidevice_full
      if (!usesMonthlyBuckets(query_options.timeperiod)) {
        await this.query_category_time_by_period(query_options);
      }
    },

    get_buckets_multidevice(this: State, hosts: string[]) {
      const bucketsStore = useBucketsStore();
      const collect = (f: (host: string) => string[]) => _.uniq(_.flatMap(hosts, f));
      this.buckets.afk = collect(bucketsStore.bucketsAFK);
      this.buckets.window = collect(bucketsStore.bucketsWindow);
      this.buckets.android = collect(bucketsStore.bucketsAndroid);
      this.buckets.browser = [];
      this.buckets.editor = collect(bucketsStore.bucketsEditor);
      this.buckets.stopwatch = [];
      this.buckets.loaded = true;
    },

    multidevice_params(
      { filter_categories, filter_afk, always_active_pattern }: QueryOptions,
      hosts: string[]
    ): MultiQueryParams {
      const bucketsStore = useBucketsStore();
      // Pass each host's actual bucket IDs (see buildMultideviceHostParams),
      // so that buckets synced from another host — whose IDs carry an
      // "-synced-from-<host>" suffix — are queried instead of the
      // reconstructed "aw-watcher-window_<host>" IDs which don't exist in
      // the local datastore. Hosts with only an android/ScreenTime bucket
      // (no afkstatus bucket, e.g. a synced phone) are included via the
      // android query path instead of being dropped.
      const { host_params, hosts_with_buckets } = buildMultideviceHostParams(
        hosts,
        host => bucketsStore.bucketsWindow(host),
        host => bucketsStore.bucketsAFK(host),
        host => bucketsStore.bucketsAndroid(host)
      );
      return {
        hosts: hosts_with_buckets,
        filter_afk,
        categories: useCategoryStore().classes_for_query,
        filter_categories,
        host_params,
        always_active_pattern,
      };
    },

    async query_android({ timeperiod, filter_categories }: QueryOptions) {
      // One aggregate per request; long periods (All time) are split so each
      // request stays well under the request timeout, then merged.
      const periods = splitTimeperiodStrs(timeperiod, ANDROID_MAX_DAYS_PER_REQUEST);
      const categoryStore = useCategoryStore();

      // Prefer the ScreenTime bucket when both Android watcher and ScreenTime buckets
      // exist for the same host (hybrid case). Without this, android[0] is the Android
      // watcher bucket, isIos is false, and ScreenTime data is never processed.
      const iosBucket = this.buckets.android.find((id: string) =>
        id.startsWith('aw-import-screentime')
      );
      const selectedBucket = iosBucket || this.buckets.android[0];

      const isIos = !!iosBucket;
      const q = queries.appQuery(
        selectedBucket,
        categoryStore.classes_for_query,
        filter_categories,
        isIos,
        periods.length > 1 ? CHUNKED_QUERY_LIMIT : undefined
      );
      this.progress_add(periods.length);
      const chunks = [];
      for (const period of periods) {
        const result = await getClient().query([period], q).catch(this.errorHandler);
        this.progress_tick();
        if (!(result && result[0])) {
          // Don't show partial totals as if they covered the whole period
          this.query_window_completed();
          return;
        }
        chunks.push(result[0]);
      }
      const data = [mergeAppQueryResults(chunks, isIos)];

      if (isIos && data && data[0] && data[0].title_events) {
        // Build bundle ID → human name lookup from title_events before modifying them.
        // title_events has 'app' = bundle ID and 'title' = human-readable name.
        // For ScreenTime imports each bundle ID maps to exactly one human-readable name,
        // so the server's top-100 title groups and top-100 app groups rank identically —
        // this lookup covers every app_events entry. Apps with no title fall back to the
        // raw bundle ID via the `|| bundleId` guard below.
        const bundleIdToName: Record<string, string> = {};
        data[0].title_events.forEach((e: IEvent) => {
          if (e.data.title && !bundleIdToName[e.data.app]) {
            bundleIdToName[e.data.app] = e.data.title;
          }
        });

        // Remap title_events: swap bundle ID → human name, store bundle ID as classname.
        data[0].title_events.forEach((e: IEvent) => {
          const originalApp = e.data.app;
          e.data.classname = originalApp; // Bundle ID (e.g. com.google.ios.youtube)
          e.data.app = e.data.title || originalApp; // Human name (e.g. YouTube), or bundle ID if absent
        });

        // Remap app_events directly using the lookup, preserving the server's complete aggregation.
        // Re-aggregating from title_events would corrupt totals when there are >100 distinct apps,
        // because title_events is capped at 100 entries by the query.
        // app_cat_events is keyed by app too, so it needs the same remap.
        [data[0].app_events, data[0].app_cat_events].forEach((events?: IEvent[]) => {
          (events || []).forEach((e: IEvent) => {
            const bundleId = e.data.app;
            e.data.classname = bundleId;
            e.data.app = bundleIdToName[bundleId] || bundleId;
          });
        });
      }

      this.query_window_completed(data[0]);
    },

    async query_browser_only({ timeperiod }: QueryOptions) {
      const q = queries.browserOnlyQuery(this.buckets.browser);
      this.progress_add(1);
      const result = await getClient()
        .query([timeperiodToStr(timeperiod)], q, { name: 'browserOnlyQuery' })
        .catch(this.errorHandler);
      this.progress_tick();
      if (result && result[0] && result[0].browser) {
        this.query_browser_completed(result[0].browser);
      } else {
        this.query_browser_completed({});
      }
    },

    async reset() {
      getClient().abort();
      this.query_window_completed({});
      this.query_browser_completed({});
      this.query_editor_completed({});
      this.query_category_time_by_period_completed({});
    },

    async query_multidevice_full(query_options: QueryOptions, hosts: string[]) {
      const periods = periodsForFullDesktopQuery(query_options.timeperiod);
      this.progress_add(periods.length);
      const params = this.multidevice_params(query_options, hosts);
      const q = queries.multideviceQuery(params);
      const { merged, chunks } = await queryDesktopPeriods(periods, q, 'multidevice', () =>
        this.progress_tick()
      );
      const windowResult = merged.window || {};
      if (usesMonthlyBuckets(query_options.timeperiod)) {
        // As in query_desktop_full: long ranges don't keep years of active
        // events in state, and build the monthly barchart from the chunks.
        windowResult.active_events = [];
        this.query_category_time_by_period_completed({
          by_period: categoryByPeriodFromChunks(query_options.timeperiod, chunks),
        });
      }

      // ScreenTime (iOS) events carry the bundle ID as "app": show the app
      // name instead, as the single-device view (query_android) does.
      const screentimeBuckets = _.values(params.host_params)
        .filter((p: any) => p.isIos && p.bid_android)
        .map((p: any) => p.bid_android as string);
      if (screentimeBuckets.length > 0 && windowResult.app_events) {
        // Same periods as the main query, in bounded requests. The names
        // are cosmetic: if the lookup fails, keep the results as they are.
        const namesQuery = queries.screentimeNamesQuery(screentimeBuckets);
        const bundleIdToName: Record<string, string> = {};
        // Captured up front: the client replaces its controller on abort
        const signal = getClient().controller.signal;
        try {
          for (const chunk of chunkPeriodsBySpan(periods)) {
            const results = await getClient().query(chunk, namesQuery, {
              name: 'screentimeNamesQuery',
            });
            (results || []).forEach((events: IEvent[]) =>
              _.defaults(bundleIdToName, screentimeNameMap(events || []))
            );
          }
        } catch (e) {
          if (signal.aborted) throw e;
          console.warn('Failed to look up ScreenTime app names', e);
        }
        applyScreentimeNames(windowResult.app_events, bundleIdToName);
        applyScreentimeNames(windowResult.app_cat_events || [], bundleIdToName);
        applyScreentimeNames(windowResult.title_events || [], bundleIdToName);
      }
      this.query_window_completed(windowResult);
    },

    async query_desktop_full({
      timeperiod,
      filter_categories,
      filter_afk,
      include_audible,
      include_stopwatch,
      always_active_pattern,
    }: QueryOptions) {
      const periods = periodsForFullDesktopQuery(timeperiod);
      this.progress_add(periods.length);
      const categories = useCategoryStore().classes_for_query;

      const q = queries.fullDesktopQuery({
        bid_window: this.buckets.window[0],
        bid_afk: this.buckets.afk[0],
        bid_browsers: this.buckets.browser,
        bid_stopwatch:
          include_stopwatch && this.buckets.stopwatch.length > 0
            ? this.buckets.stopwatch[0]
            : undefined,
        filter_afk,
        categories,
        filter_categories,
        include_audible,
        always_active_pattern,
      });
      const { merged, chunks } = await queryDesktopPeriods(periods, q, 'fullDesktopQuery', () =>
        this.progress_tick()
      );
      if (usesMonthlyBuckets(timeperiod) && merged.window) {
        // active_events is only used to skip inactive periods in the
        // category-by-period query, which long ranges don't run. Don't keep
        // years of AFK events in reactive state.
        merged.window.active_events = [];
      }
      this.query_window_completed(merged.window || {});
      if (usesMonthlyBuckets(timeperiod)) {
        // Long ranges: build the monthly barchart from the chunk results
        // instead of querying every month again (month-sized category
        // queries took 10-38 s each on a 1.7 GB database, past the timeout).
        this.query_category_time_by_period_completed({
          by_period: categoryByPeriodFromChunks(timeperiod, chunks),
        });
      }
      this.query_browser_completed(merged.browser || {});
      if (include_stopwatch) {
        this.query_stopwatch_completed(merged.stopwatch || {});
      }
    },

    async query_editor({ timeperiod }) {
      const periods = splitTimeperiodStrs(timeperiod, EDITOR_MAX_DAYS_PER_REQUEST);
      const q = queries.editorActivityQuery(
        this.buckets.editor,
        periods.length > 1 ? CHUNKED_QUERY_LIMIT : undefined
      );
      this.progress_add(periods.length);
      const chunks = [];
      for (const period of periods) {
        const data = await getClient().query([period], q, {
          name: 'editorActivityQuery',
          verbose: true,
        });
        this.progress_tick();
        if (data && data[0]) chunks.push(data[0]);
      }
      this.query_editor_completed(chunks.length === 1 ? chunks[0] : mergeEditorResults(chunks));
    },

    /**
     * Start of the earliest day with data in any bucket the Activity view may
     * query for `host` (all hosts when multidevice is on), or null if there is
     * none. `approximate` is set when the lookup failed and bucket creation
     * dates were used instead (not cached, see below).
     */
    async get_earliest_date(
      host: string,
      { force = false }: { force?: boolean } = {}
    ): Promise<{ date: string | null; approximate: boolean }> {
      const settingsStore = useSettingsStore();
      const bucketsStore = useBucketsStore();
      await bucketsStore.ensureLoaded();
      // The devices the Activity query will include (see resolve_multidevice_hosts)
      const selected = this.resolve_multidevice_hosts(host);
      const hosts = selected.length > 0 ? selected : [host];
      const ids = _.uniq(
        _.flatMap(hosts, h => [
          ...bucketsStore.bucketsWindow(h),
          ...bucketsStore.bucketsAFK(h),
          ...bucketsStore.bucketsAndroid(h),
          ...bucketsStore.bucketsEditor(h),
          ...bucketsStore.bucketsBrowser(h),
          ...bucketsStore.bucketsStopwatch(h),
        ])
      );
      // Keyed on the bucket IDs too, so e.g. importing a bucket with older
      // events (which reloads the buckets store) is picked up.
      const key = JSON.stringify([hosts, settingsStore.startOfDay, [...ids].sort()]);
      if (!force && earliestDateCache.has(key)) {
        return { date: earliestDateCache.get(key), approximate: false };
      }

      const buckets = ids.map(id => bucketsStore.getBucket(id)).filter(b => b);
      const client = getClient();
      let earliest: Date | null;
      try {
        earliest = await earliestEventInBuckets(buckets, (id, params) =>
          client.getEvents(id, params)
        );
      } catch (e) {
        // Fall back to bucket creation dates (not cached, so a refresh retries)
        console.warn('Failed to find earliest event, using bucket creation dates', e);
        const created = buckets.map(b => b.first_seen).filter(d => d);
        const date =
          created.length > 0
            ? moment(_.min(created.map(d => new Date(d).getTime())))
                .subtract(get_offset_duration(settingsStore.startOfDay))
                .format('YYYY-MM-DD')
            : null;
        return { date, approximate: true };
      }
      const date = earliest
        ? moment(earliest)
            .subtract(get_offset_duration(settingsStore.startOfDay))
            .format('YYYY-MM-DD')
        : null;
      earliestDateCache.set(key, date);
      return { date, approximate: false };
    },

    async query_active_history({ timeperiod }: QueryOptions) {
      // Filter out periods that are already in the history, and that are in the future
      const periods = uncachedHistoryPeriods(
        timeperiodStrsAroundTimeperiod(timeperiod),
        this.active.history
      );
      const afk_buckets = [this.buckets.afk[0]];
      const query = queries.activityQuery(afk_buckets);
      const client = getClient();
      const signal = client.controller.signal;
      const data: IEvent[][] = [];
      for (const chunk of chunkPeriodsBySpan(periods)) {
        if (signal.aborted) {
          throw signal['reason'] || 'unknown reason';
        }
        data.push(...(await client.query(chunk, query, { name: 'activityQuery', verbose: true })));
      }
      const active_history = _.zipObject(
        periods,
        _.map(data, pair => _.filter(pair, e => e.data.status == 'not-afk'))
      );
      this.query_active_history_completed({ active_history });
    },

    async query_category_time_by_period(
      query_options: QueryOptions & { dontQueryInactive?: boolean }
    ) {
      const {
        timeperiod,
        filter_categories,
        filter_afk,
        include_stopwatch,
        dontQueryInactive,
        always_active_pattern,
      } = query_options;
      // Several devices selected: categorize the combined multidevice timeline.
      const multideviceParams =
        this.query_hosts.length > 1
          ? this.multidevice_params(query_options, this.query_hosts)
          : null;
      // TODO: Needs to be adapted for Android
      // Hours for a single day, days for up to MAX_DAILY_BUCKETS days,
      // calendar months for a year and longer ranges.
      let periods: string[] = timeperiodsForBarchart(timeperiod).map(timeperiodToStr);

      // Filter out periods that start in the future
      periods = periods.filter(period => new Date(period.split('/')[0]) < new Date());
      this.progress_add(periods.length);

      const signal = getClient().controller.signal;
      let cancelled = false;
      signal.onabort = () => {
        cancelled = true;
        console.debug('Request aborted');
      };

      // Query one period at a time, to avoid timeout on slow queries
      let data = [];
      for (const period of periods) {
        // Not stable
        //signal.throwIfAborted();
        if (cancelled) {
          throw signal['reason'] || 'unknown reason';
        }
        this.progress_tick();

        // Only query periods with known data from AFK bucket
        if (dontQueryInactive && this.active.events.length > 0) {
          const start = new Date(period.split('/')[0]);
          const end = new Date(period.split('/')[1]);

          // Retrieve active time in period
          const period_activity = this.active.events.find((e: IEvent) => {
            return start < new Date(e.timestamp) && new Date(e.timestamp) < end;
          });

          // Check if there was active time
          if (!(period_activity && period_activity.duration > 0)) {
            data = data.concat([{ cat_events: [] }]);
            continue;
          }
        }

        // Prefer ScreenTime bucket over Android watcher for consistency with query_android
        const iosBucketForCategory = this.buckets.android.find((id: string) =>
          id.startsWith('aw-import-screentime')
        );
        const iosOrAndroidBucket = iosBucketForCategory || this.buckets.android[0];
        const isAndroid = iosOrAndroidBucket !== undefined;
        // ScreenTime (iOS) buckets carry a "title" key; aw-watcher-android buckets do not.
        // Pass isIos so canonicalEvents uses the correct merge keys and titles are preserved.
        const isIosForCategory = !!iosBucketForCategory;
        const categories = useCategoryStore().classes_for_query;
        // TODO: Clean up call, pass QueryParams in fullDesktopQuery as well
        // TODO: Unify QueryOptions and QueryParams
        const query = multideviceParams
          ? queries.categoryQuery(multideviceParams)
          : queries.categoryQuery({
              bid_browsers: this.buckets.browser,
              bid_stopwatch:
                include_stopwatch && this.buckets.stopwatch.length > 0
                  ? this.buckets.stopwatch[0]
                  : undefined,
              categories,
              filter_categories,
              filter_afk,
              always_active_pattern,
              ...(isAndroid
                ? {
                    bid_android: iosOrAndroidBucket,
                    isIos: isIosForCategory,
                  }
                : {
                    bid_afk: this.buckets.afk[0],
                    bid_window: this.buckets.window[0],
                  }),
            });
        const result = await getClient().query([period], query, {
          verbose: true,
          name: 'categoryQuery',
        });
        data = data.concat(result);
      }

      // Zip periods
      let by_period = _.zipObject(periods, data);
      // Filter out values that are undefined (no longer needed, only used when visualization was progressive (looks buggy))
      by_period = _.fromPairs(_.toPairs(by_period).filter(o => o[1]));

      this.query_category_time_by_period_completed({ by_period });
    },

    async query_active_history_multidevice({ timeperiod }: QueryOptions, hosts: string[]) {
      const bucketsStore = useBucketsStore();
      const periods = uncachedHistoryPeriods(
        timeperiodStrsAroundTimeperiod(timeperiod),
        this.active.history
      );
      // Same bucket choice per host as the multidevice query: desktop hosts
      // contribute their afk bucket, mobile hosts their app-usage bucket.
      const { host_params } = buildMultideviceHostParams(
        hosts,
        host => bucketsStore.bucketsWindow(host),
        host => bucketsStore.bucketsAFK(host),
        host => bucketsStore.bucketsAndroid(host)
      );
      const afk_buckets: string[] = [];
      const android_buckets: string[] = [];
      _.values(host_params).forEach(p => {
        if ('bid_afk' in p) afk_buckets.push(p.bid_afk);
        else android_buckets.push(p.bid_android);
      });
      // Bounded request span, as in query_active_history (Year view would
      // otherwise send ~16 years of every device's data in one request).
      const query = queries.multideviceActivityQuery(afk_buckets, android_buckets);
      const client = getClient();
      const signal = client.controller.signal;
      const data: number[] = [];
      for (const chunk of chunkPeriodsBySpan(periods)) {
        if (signal.aborted) {
          throw signal['reason'] || 'unknown reason';
        }
        data.push(
          ...(await client.query(chunk, query, { name: 'multideviceActivityQuery', verbose: true }))
        );
      }
      const active_history = _.zipObject(
        periods,
        _.map(data, (duration: number, i: number): IEvent[] => [
          { timestamp: periods[i].split('/')[0], duration, data: { status: 'not-afk' } },
        ])
      );
      this.query_active_history_completed({ active_history });
    },

    async query_active_history_android({ timeperiod }: QueryOptions) {
      const periods = uncachedHistoryPeriods(
        timeperiodStrsAroundTimeperiod(timeperiod),
        this.active.history
      );
      // Prefer ScreenTime bucket over Android watcher for consistency with query_android
      const iosOrAndroidBucket =
        this.buckets.android.find((id: string) => id.startsWith('aw-import-screentime')) ||
        this.buckets.android[0];
      const data = await getClient().query(
        periods,
        queries.activityQueryAndroid(iosOrAndroidBucket)
      );
      const active_history = _.zipObject(periods, data);
      const active_history_events = _.mapValues(
        active_history,
        (duration: number, key): [IEvent] => {
          return [{ timestamp: key.split('/')[0], duration, data: { status: 'not-afk' } }];
        }
      );
      this.query_active_history_completed({ active_history: active_history_events });
    },

    set_available(this: State) {
      // TODO: Move to bucketStore on a per-host basis?
      this.window.available = this.buckets.afk.length > 0 && this.buckets.window.length > 0;
      this.browser.available = this.buckets.browser.length > 0;
      this.active.available = this.buckets.afk.length > 0;
      this.editor.available = this.buckets.editor.length > 0;
      this.android.available = this.buckets.android.length > 0;
      this.ios.available = this.buckets.android.some(id => id.startsWith('aw-import-screentime'));
      this.category.available = this.window.available || this.android.available;
      this.stopwatch.available = this.buckets.stopwatch.length > 0;
    },

    async get_buckets(this: State, { host }) {
      // TODO: Move to bucketStore on a per-host basis?
      const bucketsStore = useBucketsStore();
      this.buckets.afk = bucketsStore.bucketsAFK(host);
      this.buckets.window = bucketsStore.bucketsWindow(host);
      this.buckets.android = bucketsStore.bucketsAndroid(host);
      this.buckets.browser = bucketsStore.bucketsBrowser(host);
      this.buckets.editor = bucketsStore.bucketsEditor(host);
      this.buckets.stopwatch = bucketsStore.bucketsStopwatch(host);

      console.log('Available buckets: ', this.buckets);
      this.buckets.loaded = true;
    },

    async load_demo() {
      // A function to load some demo data (for screenshots and stuff)

      this.start_loading({});

      function groupSumEventsBy(events, key, f) {
        return flow(
          filter(f),
          groupBy(f),
          values,
          map((es: any) => {
            return { duration: _.sumBy(es, 'duration'), data: { [key]: f(es[0]) } };
          }),
          sortBy('duration'),
          reverse
        )(events);
      }

      const app_events = groupSumEventsBy(window_events, 'app', (e: any) => e.data.app);
      const title_events = groupSumEventsBy(window_events, 'title', (e: any) => e.data.title);
      const cat_events = groupSumEventsBy(window_events, '$category', (e: any) => e.data.$category);
      const url_events = groupSumEventsBy(window_events, 'url', (e: any) => e.data.url);
      const domain_events = groupSumEventsBy(window_events, '$domain', (e: any) =>
        e.data.url === undefined ? '' : new URL(e.data.url).host
      );
      const browser_title_events = groupSumEventsBy(
        window_events.filter((e: any) => e.data.url),
        'title',
        (e: any) => e.data.title
      );

      this.query_window_completed({
        duration: _.sumBy(window_events, 'duration'),
        app_events,
        title_events,
        cat_events,
        active_events: [
          {
            timestamp: new Date().toISOString(),
            duration: 1.5 * 60 * 60,
            data: { afk: 'not-afk' },
          },
        ],
      });

      this.buckets.browser = ['aw-watcher-firefox'];
      this.query_browser_completed({
        duration: _.sumBy(url_events, 'duration'),
        domains: domain_events,
        urls: url_events,
        titles: browser_title_events,
      });

      this.buckets.editor = ['aw-watcher-vim'];
      this.query_editor_completed({
        duration: 30,
        files: [{ duration: 10, data: { file: 'test.py' } }],
        languages: [{ duration: 10, data: { language: 'python' } }],
        projects: [{ duration: 10, data: { project: 'aw-core' } }],
      });

      this.buckets.loaded = true;

      // fetch startOfDay from settings store
      const settingsStore = useSettingsStore();
      const startOfDay = settingsStore.startOfDay;

      function build_active_history() {
        const active_history = {};
        let current_day = moment(get_day_start_with_offset(null, startOfDay));
        _.map(_.range(0, 30), () => {
          const current_day_end = moment(current_day).add(1, 'day');
          active_history[`${current_day.format()}/${current_day_end.format()}`] = [
            {
              timestamp: current_day.format(),
              duration: 100 + 900 * Math.random(),
              data: { status: 'not-afk' },
            },
          ];
          current_day = current_day.add(-1, 'day');
        });
        return active_history;
      }
      this.query_active_history_completed({ active_history: build_active_history() });
    },

    // mutations
    start_loading(this: State, query_options: QueryOptions) {
      this.loaded = true;
      this.query_options = query_options;

      // Resets the store state while waiting for new query to finish
      this.window.top_apps = null;
      this.window.top_titles = null;

      this.browser.duration = 0;
      this.browser.top_domains = null;
      this.browser.top_urls = null;
      this.browser.top_titles = null;

      this.editor.duration = 0;
      this.editor.top_files = null;
      this.editor.top_languages = null;
      this.editor.top_projects = null;

      this.category.top = null;
      this.category.by_period = null;

      this.active.duration = null;
      this.progress = null;

      // The active history is cached across date changes (see
      // query_active_history*), and invalidated in set_history_key when
      // the queried devices or buckets change.
    },

    // Clear the cached active history if it was computed from other
    // devices/buckets: another host, a changed selection, or a new device
    // showing up under "all devices".
    set_history_key(this: State) {
      const key = JSON.stringify([this.query_hosts, this.buckets.afk, this.buckets.android]);
      if (this.active.history_key !== key) {
        this.active.history = {};
        this.active.history_key = key;
      }
    },

    query_window_completed(
      this: State,
      data: Record<string, any> = {
        app_events: [],
        title_events: [],
        cat_events: [],
        active_events: [],
        duration: 0,
      }
    ) {
      // Set $color and $score for categories
      if (data.cat_events) {
        data.cat_events = colorCategories(data.cat_events);
        data.cat_events = scoreCategories(data.cat_events);
      }

      this.window.top_apps = withDominantCategory(data.app_events, data.app_cat_events);
      this.window.top_titles = data.title_events;
      this.category.top = data.cat_events;
      this.active.duration = data.duration;
      this.active.events = data.active_events;
    },

    query_browser_completed(
      this: State,
      data = { domains: [], urls: [], titles: [], duration: 0 }
    ) {
      this.browser.top_domains = data.domains;
      this.browser.top_urls = data.urls;
      this.browser.top_titles = data.titles;
      this.browser.duration = data.duration;
    },

    query_stopwatch_completed(this: State, data = { stopwatch_events: [] }) {
      this.stopwatch.top_stopwatches = data.stopwatch_events;
    },

    query_editor_completed(
      this: State,
      data = { duration: 0, files: [], languages: [], projects: [] }
    ) {
      this.editor.duration = data.duration;
      this.editor.top_files = data.files;
      this.editor.top_languages = data.languages;
      this.editor.top_projects = data.projects;
    },

    progress_add(this: State, n: number) {
      if (this.progress === null) {
        this.progress = { done: 0, total: n };
      } else {
        this.progress = { ...this.progress, total: this.progress.total + n };
      }
    },

    progress_tick(this: State) {
      if (this.progress !== null) {
        this.progress = { ...this.progress, done: this.progress.done + 1 };
      }
    },

    query_active_history_completed(this: State, { active_history } = { active_history: {} }) {
      this.active.history = {
        ...this.active.history,
        ...active_history,
      };
    },

    query_category_time_by_period_completed(this: State, { by_period } = { by_period: [] }) {
      this.category.by_period = by_period;
    },
  },
});
