import { defineStore } from 'pinia';
import moment from 'moment';
import * as _ from 'lodash';
import { map, filter, values, groupBy, sortBy, flow, reverse } from 'lodash/fp';
import { IEvent } from '~/util/interfaces';

import { window_events } from '~/util/fakedata';
import queries from '~/queries';
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
import { buildMultideviceHostParams } from '~/util/multidevice';
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

// Max days per request for queries returning one aggregate for the whole
// period (editor, Android). Only long periods (e.g. All time) get split.
const EDITOR_MAX_DAYS_PER_REQUEST = 366;
const ANDROID_MAX_DAYS_PER_REQUEST = 92;

// Per-chunk limit when a query is split: items outside one chunk's top 100
// can still be in the overall top 100 once summed, so over-fetch and cut
// after merging.
const CHUNKED_QUERY_LIMIT = 1000;

// host -> first day with data (YYYY-MM-DD), see get_earliest_date
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
      const settingsStore = useSettingsStore();
      await settingsStore.ensureLoaded();

      const bucketsStore = useBucketsStore();

      console.info('Query options: ', query_options);
      if (this.loaded) {
        getClient().abort();
      }
      if (!this.loaded || this.query_options !== query_options || query_options.force) {
        this.start_loading(query_options);
        if (!query_options.timeperiod) {
          query_options.timeperiod = dateToTimeperiod(query_options.date, settingsStore.startOfDay);
        }

        await bucketsStore.ensureLoaded();
        await this.get_buckets(query_options);

        // TODO: These queries can actually run in parallel, but since server won't process them in parallel anyway we won't.
        this.set_available();

        if (this.window.available) {
          console.info(
            settingsStore.useMultidevice ? 'Querying multiple devices' : 'Querying a single device'
          );
          if (settingsStore.useMultidevice) {
            const hostnames = bucketsStore.hosts.filter(
              // require that the host has either a window+afk bucket pair
              // (canonicalEvents needs the pair) or an android/ScreenTime
              // bucket (routed through buildMultideviceHostParams' fallback
              // path), and that the host is not a fakedata host, unless
              // we're explicitly querying fakedata
              host =>
                host &&
                ((bucketsStore.bucketsWindow(host).length > 0 &&
                  bucketsStore.bucketsAFK(host).length > 0) ||
                  bucketsStore.bucketsAndroid(host).length > 0) &&
                (!host.startsWith('fakedata') || query_options.host.startsWith('fakedata'))
            );
            console.info('Including hosts in multiquery: ', hostnames);
            await this.query_multidevice_full(query_options, hostnames);
          } else {
            await this.query_desktop_full(query_options);
          }
        } else if (this.android.available) {
          await this.query_android(query_options);
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
        const derivedByPeriod =
          this.window.available &&
          !settingsStore.useMultidevice &&
          usesMonthlyBuckets(query_options.timeperiod);
        if ((this.window.available || this.android.available) && !derivedByPeriod) {
          await this.query_category_time_by_period(query_options);
        }
        this.progress = null;
      } else {
        console.warn(
          'ensure_loaded called twice with same query_options but without query_options.force = true, skipping...'
        );
      }
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
        if (data[0].app_events) {
          data[0].app_events.forEach((e: IEvent) => {
            const bundleId = e.data.app;
            e.data.classname = bundleId;
            e.data.app = bundleIdToName[bundleId] || bundleId;
          });
        }
      }

      this.query_window_completed(data[0]);
    },

    async reset() {
      getClient().abort();
      this.query_window_completed({});
      this.query_browser_completed({});
      this.query_editor_completed({});
      this.query_category_time_by_period_completed({});
    },

    async query_multidevice_full(
      { timeperiod, filter_categories, filter_afk, always_active_pattern }: QueryOptions,
      hosts: string[]
    ) {
      const periods = periodsForFullDesktopQuery(timeperiod);
      this.progress_add(periods.length);
      const categories = useCategoryStore().classes_for_query;
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

      const q = queries.multideviceQuery({
        hosts: hosts_with_buckets,
        filter_afk,
        categories,
        filter_categories,
        host_params,
        always_active_pattern,
      });
      const { merged } = await queryDesktopPeriods(periods, q, 'multidevice', () =>
        this.progress_tick()
      );
      this.query_window_completed(merged.window || {});
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
     * none. Cached per host and day-start offset.
     */
    async get_earliest_date(host: string): Promise<string | null> {
      const settingsStore = useSettingsStore();
      const bucketsStore = useBucketsStore();
      await bucketsStore.ensureLoaded();
      const hosts = settingsStore.useMultidevice ? bucketsStore.hosts : [host];
      const key = [hosts.join(','), settingsStore.startOfDay].join('|');
      if (earliestDateCache.has(key)) return earliestDateCache.get(key);

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
        return created.length > 0
          ? moment(_.min(created.map(d => new Date(d).getTime())))
              .subtract(get_offset_duration(settingsStore.startOfDay))
              .format('YYYY-MM-DD')
          : null;
      }
      const date = earliest
        ? moment(earliest)
            .subtract(get_offset_duration(settingsStore.startOfDay))
            .format('YYYY-MM-DD')
        : null;
      earliestDateCache.set(key, date);
      return date;
    },

    async query_active_history({ timeperiod, ...query_options }: QueryOptions) {
      const settingsStore = useSettingsStore();
      const bucketsStore = useBucketsStore();
      // Filter out periods that are already in the history, and that are in the future
      const periods = timeperiodStrsAroundTimeperiod(timeperiod).filter(tp_str => {
        return (
          !_.includes(this.active.history, tp_str) && new Date(tp_str.split('/')[0]) < new Date()
        );
      });
      let afk_buckets: string[] = [];
      if (settingsStore.useMultidevice) {
        // get all hostnames that qualify for the multidevice query
        const hostnames = bucketsStore.hosts.filter(
          // require that the host has afk buckets,
          // and that the host is not a fakedata host,
          // unless we're explicitly querying fakedata
          host =>
            host &&
            bucketsStore.bucketsAFK(host).length > 0 &&
            (!host.startsWith('fakedata') || query_options.host.startsWith('fakedata'))
        );
        // get all afk buckets for all hosts
        afk_buckets = _.flatten(hostnames.map(bucketsStore.bucketsAFK));
      } else {
        afk_buckets = [this.buckets.afk[0]];
      }
      const query = queries.activityQuery(afk_buckets);
      const data = await getClient().query(periods, query, {
        name: 'activityQuery',
        verbose: true,
      });
      const active_history = _.zipObject(
        periods,
        _.map(data, pair => _.filter(pair, e => e.data.status == 'not-afk'))
      );
      this.query_active_history_completed({ active_history });
    },

    async query_category_time_by_period({
      timeperiod,
      filter_categories,
      filter_afk,
      include_stopwatch,
      dontQueryInactive,
      always_active_pattern,
    }: QueryOptions & { dontQueryInactive: boolean }) {
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
        const query = queries.categoryQuery({
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

    async query_active_history_android({ timeperiod }: QueryOptions) {
      const periods = timeperiodStrsAroundTimeperiod(timeperiod).filter(tp_str => {
        return !_.includes(this.active.history, tp_str);
      });
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
      this.browser.available =
        this.buckets.afk.length > 0 &&
        this.buckets.window.length > 0 &&
        this.buckets.browser.length > 0;
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

      // Ensures that active history isn't being fully reloaded on every date change
      // (see caching done in query_active_history and query_active_history_android)
      // FIXME: Better detection of when to actually clear (such as on force reload, hostname change)
      if (Object.keys(this.active.history).length === 0) {
        this.active.history = {};
      }
    },

    query_window_completed(
      this: State,
      data = { app_events: [], title_events: [], cat_events: [], active_events: [], duration: 0 }
    ) {
      // Set $color and $score for categories
      if (data.cat_events) {
        data.cat_events = colorCategories(data.cat_events);
        data.cat_events = scoreCategories(data.cat_events);
      }

      this.window.top_apps = data.app_events;
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
