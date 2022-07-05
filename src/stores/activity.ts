import { defineStore } from 'pinia';
import moment from 'moment';
import * as _ from 'lodash';
import { map, filter, values, groupBy, sortBy, flow, reverse } from 'lodash/fp';
import { IEvent } from '~/util/interfaces';

import { window_events } from '~/util/fakedata';
import queries from '~/queries';
import { getColorFromCategory } from '~/util/color';
import { loadClassesForQuery } from '~/util/classes';
import { get_day_start_with_offset } from '~/util/time';
import {
  TimePeriod,
  dateToTimeperiod,
  timeperiodToStr,
  timeperiodsHoursOfPeriod,
  timeperiodsDaysOfPeriod,
  timeperiodsMonthsOfPeriod,
  timeperiodsAroundTimeperiod,
} from '~/util/timeperiod';

import { useSettingsStore } from '~/stores/settings';
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';

import { getClient } from '~/util/awclient';

function timeperiodsStrsHoursOfPeriod(timeperiod: TimePeriod): string[] {
  return timeperiodsHoursOfPeriod(timeperiod).map(timeperiodToStr);
}

function timeperiodsStrsDaysOfPeriod(timeperiod: TimePeriod): string[] {
  return timeperiodsDaysOfPeriod(timeperiod).map(timeperiodToStr);
}

function timeperiodsStrsMonthsOfPeriod(timeperiod: TimePeriod): string[] {
  return timeperiodsMonthsOfPeriod(timeperiod).map(timeperiodToStr);
}

function timeperiodStrsAroundTimeperiod(timeperiod: TimePeriod): string[] {
  return timeperiodsAroundTimeperiod(timeperiod).map(timeperiodToStr);
}

function colorCategories(events: IEvent[]): IEvent[] {
  // Set $color for categories
  const categoryStore = useCategoryStore();
  return events.map((e: IEvent) => {
    const cat = categoryStore.get_category(e.data['$category']);
    e.data['$color'] = getColorFromCategory(cat, categoryStore.classes);
    return e;
  });
}

interface QueryOptions {
  host: string;
  date?: string;
  timeperiod?: TimePeriod;
  filterAFK?: boolean;
  includeAudible?: boolean;
  filterCategories?: string[][];
  force?: boolean;
}

export const useActivityStore = defineStore('activity', {
  // initial state
  state: () => ({
    // set to true once loading has started
    loaded: false,

    window: {
      available: false,
      top_apps: [],
      top_titles: [],
    },

    browser: {
      available: false,
      duration: [],
      top_domains: [],
      top_urls: [],
    },

    editor: {
      available: false,
      duration: [],
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

    query_options: {
      browser_buckets: 'all',
      editor_buckets: 'all',
    },

    buckets: {
      loaded: false,
      afk: [],
      window: [],
      editor: [],
      browser: [],
      android: [],
    },
  }),

  getters: {
    getActiveHistoryAroundTimeperiod() {
      return (timeperiod: TimePeriod) => {
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
  },

  actions: {
    async ensure_loaded(query_options: QueryOptions) {
      const settingsStore = useSettingsStore();
      await settingsStore.ensureLoaded();

      const bucketsStore = useBucketsStore();

      const startOfDayOffset = settingsStore.startOfDay;

      console.info('Query options: ', query_options);
      if (this.loaded) {
        getClient().abort();
      }
      if (!this.loaded || this.query_options !== query_options || query_options.force) {
        this.start_loading(query_options);
        if (!query_options.timeperiod) {
          query_options.timeperiod = dateToTimeperiod(query_options.date, startOfDayOffset);
        }

        await bucketsStore.ensureLoaded();
        await this.get_buckets(query_options);

        // TODO: These queries can actually run in parallel, but since server won't process them in parallel anyway we won't.
        await this.set_available(query_options);

        // TODO: Move me
        const multidevice = true;

        if (this.window.available) {
          if (multidevice) {
            const hostnames = bucketsStore.hosts.filter(
              host =>
                bucketsStore.windowBucketsByHost(host).length > 0 && !host.startsWith('fakedata')
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
          await this.reset_window();
          await this.reset_category();
        }

        if (this.active.available) {
          await this.query_active_history(query_options);
        } else if (this.android.available) {
          await this.query_active_history_android(query_options);
        } else {
          console.log('Cannot call query_active_history as we do not have an afk bucket');
          await this.query_active_history_empty(query_options);
        }

        if (this.editor.available) {
          await this.query_editor(query_options);
        } else {
          console.log('Cannot call query_editor as we do not have any editor buckets');
          await this.reset_editor();
        }

        if (this.window.available) {
          // Perform this last, as it takes the longest
          await this.query_category_time_by_period({ ...query_options, dontQueryInactive: true });
        }
      } else {
        console.warn(
          'ensure_loaded called twice with same query_options but without query_options.force = true, skipping...'
        );
      }
    },

    async query_android({ timeperiod, filterCategories }: QueryOptions) {
      const periods = [timeperiodToStr(timeperiod)];
      const classes = loadClassesForQuery();
      const q = queries.appQuery(this.buckets.android[0], classes, filterCategories);
      const data = await getClient().query(periods, q).catch(this.errorHandler);
      this.query_window_completed(data[0]);
    },

    async reset() {
      getClient().abort();
      await this.reset_window();
      await this.reset_browser();
      await this.reset_editor();
      await this.reset_category();
    },

    async reset_window() {
      const data = {
        app_events: [],
        title_events: [],
        cat_events: [],
        active_events: [],
        duration: 0,
      };
      this.query_window_completed(data);
    },

    async reset_browser() {
      const data = {
        domains: [],
        urls: [],
        duration: 0,
      };
      this.query_browser_completed(data);
    },

    async reset_editor() {
      const data = {
        files: [],
        projects: [],
        languages: [],
      };
      this.query_editor_completed(data);
    },

    async reset_category() {
      const data = {
        by_period: [],
      };

      this.query_category_time_by_period_completed(data);
    },

    async query_multidevice_full(
      { timeperiod, filterCategories, filterAFK }: QueryOptions,
      hostnames: string[]
    ) {
      const periods = [timeperiodToStr(timeperiod)];
      const classes = loadClassesForQuery();

      const q = queries.multideviceQuery(
        // TODO: Pass these hostnames in a better way (also consider using device IDs)
        hostnames,
        filterAFK,
        classes,
        filterCategories
      );
      const data = await getClient().query(periods, q);
      const data_window = data[0].window;

      // Set $color for categories
      data_window.cat_events = colorCategories(data_window.cat_events);

      this.query_window_completed(data_window);
    },

    async query_desktop_full({
      timeperiod,
      filterCategories,
      filterAFK,
      includeAudible,
    }: QueryOptions) {
      const periods = [timeperiodToStr(timeperiod)];
      const classes = loadClassesForQuery();

      const q = queries.fullDesktopQuery(
        this.buckets.browser,
        this.buckets.window[0],
        this.buckets.afk[0],
        filterAFK,
        classes,
        filterCategories,
        includeAudible
      );
      const data = await getClient().query(periods, q);
      const data_window = data[0].window;
      const data_browser = data[0].browser;

      // Set $color for categories
      data_window.cat_events = colorCategories(data_window.cat_events);

      this.query_window_completed(data_window);
      this.query_browser_completed(data_browser);
    },

    async query_editor({ timeperiod }) {
      const periods = [timeperiodToStr(timeperiod)];
      const q = queries.editorActivityQuery(this.buckets.editor);
      const data = await getClient().query(periods, q);
      this.query_editor_completed(data[0]);
    },

    async query_active_history({ timeperiod }: QueryOptions) {
      const periods = timeperiodStrsAroundTimeperiod(timeperiod).filter(tp_str => {
        return !_.includes(this.active.history, tp_str);
      });
      const data = await getClient().query(periods, queries.activityQuery(this.buckets.afk[0]));
      const active_history = _.zipObject(
        periods,
        _.map(data, pair => _.filter(pair, e => e.data.status == 'not-afk'))
      );
      this.query_active_history_completed({ active_history });
    },

    async query_category_time_by_period({
      timeperiod,
      filterCategories,
      filterAFK,
      dontQueryInactive,
    }: QueryOptions & { dontQueryInactive: boolean }) {
      // TODO: Needs to be adapted for Android
      let periods: string[];
      if (timeperiod.length[1].startsWith('day')) {
        periods = timeperiodsStrsHoursOfPeriod(timeperiod);
      } else if (
        timeperiod.length[1].startsWith('week') ||
        timeperiod.length[1].startsWith('month')
      ) {
        periods = timeperiodsStrsDaysOfPeriod(timeperiod);
      } else if (timeperiod.length[1].startsWith('year')) {
        periods = timeperiodsStrsMonthsOfPeriod(timeperiod);
      } else {
        console.error('Unknown timeperiod');
      }

      const signal = getClient().controller.signal;
      let cancelled = false;
      signal.onabort = () => {
        cancelled = true;
        console.log('Request aborted');
      };

      const classes = loadClassesForQuery();

      // Query one period at a time, to avoid timeout on slow queries
      let data = [];
      for (const period of periods) {
        // Not stable
        //signal.throwIfAborted();
        if (cancelled) {
          throw signal['reason'] || 'unknown reason';
        }

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

        const result = await getClient().query(
          [period],
          // TODO: Clean up call, pass QueryParams in fullDesktopQuery as well
          // TODO: Unify QueryOptions and QueryParams
          queries.categoryQuery({
            bid_afk: this.buckets.afk[0],
            bid_window: this.buckets.window[0],
            bid_browsers: this.buckets.browser,
            // bid_android: this.buckets.android,
            classes: classes,
            filter_afk: filterAFK,
            filter_classes: filterCategories,
          })
        );
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
      const data = await getClient().query(
        periods,
        queries.activityQueryAndroid(this.buckets.android[0])
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

    async query_active_history_empty() {
      const data = [];
      this.query_active_history_completed(data);
    },

    async set_available() {
      // TODO: Move to bucketStore on a per-host basis?
      this.window.available = this.buckets.afk.length > 0 && this.buckets.window.length > 0;
      this.browser.available =
        this.buckets.afk.length > 0 &&
        this.buckets.window.length > 0 &&
        this.buckets.browser.length > 0;
      this.active.available = this.buckets.afk.length > 0;
      this.editor.available = this.buckets.editor.length > 0;
      this.android.available = this.buckets.android.length > 0;
      this.category.available = this.window.available || this.android.available;
    },

    async get_buckets({ host }) {
      // TODO: Move to bucketStore on a per-host basis?
      const bucketsStore = useBucketsStore();
      this.buckets.afk = bucketsStore.afkBucketsByHost(host);
      this.buckets.window = bucketsStore.windowBucketsByHost(host);
      this.buckets.android = bucketsStore.androidBucketsByHost(host);
      this.buckets.browser = bucketsStore.browserBuckets;
      this.buckets.editor = bucketsStore.editorBuckets;
      console.log('Available buckets: ', this.buckets);
      this.buckets.loaded = true;
    },

    async load_demo() {
      const settingsStore = useSettingsStore();

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
    start_loading(query_options: QueryOptions) {
      this.loaded = true;
      this.query_options = query_options;

      // Resets the store state while waiting for new query to finish
      this.window.top_apps = null;
      this.window.top_titles = null;

      this.browser.duration = 0;
      this.browser.top_domains = null;
      this.browser.top_urls = null;

      this.editor.duration = 0;
      this.editor.top_files = null;
      this.editor.top_languages = null;
      this.editor.top_projects = null;

      this.category.top = null;
      this.category.by_period = null;

      this.active.duration = null;

      // Ensures that active history isn't being fully reloaded on every date change
      // (see caching done in query_active_history and query_active_history_android)
      // FIXME: Better detection of when to actually clear (such as on force reload, hostname change)
      if (Object.keys(this.active.history).length === 0) {
        this.active.history = {};
      }
    },

    query_window_completed(data) {
      this.window.top_apps = data['app_events'];
      this.window.top_titles = data['title_events'];
      this.category.top = data['cat_events'];
      this.active.duration = data['duration'];
      this.active.events = data['active_events'];
    },

    query_browser_completed(data) {
      this.browser.top_domains = data.domains;
      this.browser.top_urls = data.urls;
      this.browser.duration = data.duration;

      // FIXME: This one might take up a lot of size in the request, move it to a seperate request
      // (or remove entirely, since we have the other timeline now)
      this.web_chunks = data['chunks'];
    },

    query_editor_completed(data) {
      this.editor.duration = data['duration'];
      this.editor.top_files = data['files'];
      this.editor.top_languages = data['languages'];
      this.editor.top_projects = data['projects'];
    },

    query_active_history_completed({ active_history }) {
      this.active.history = {
        ...this.active.history,
        ...active_history,
      };
    },

    query_category_time_by_period_completed({ by_period }) {
      this.category.by_period = by_period;
    },
  },
});
