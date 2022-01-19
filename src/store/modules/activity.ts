import moment from 'moment';
import * as _ from 'lodash';
import { map, filter, values, groupBy, sortBy, flow, reverse } from 'lodash/fp';

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
  timeperiodsAroundTimeperiod
} from '~/util/timeperiod';

interface QueryOptions {
  host: string;
  date?: string;
  timeperiod?: TimePeriod;
  filterAFK?: boolean;
  includeAudible?: boolean;
  filterCategories?: string[][];
  force?: boolean;
}

// initial state
const _state = {
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
};

function timeperiodsStrsHoursOfPeriod(timeperiod: TimePeriod): string[] {
  return timeperiodsHoursOfPeriod(timeperiod).map(timeperiodToStr);
}

function timeperiodsStrsDaysOfPeriod(timeperiod: TimePeriod): string[] {
  return timeperiodsDaysOfPeriod(timeperiod).map(timeperiodToStr);
}

function timeperiodStrsAroundTimeperiod(timeperiod: TimePeriod): string[] {
  return timeperiodsAroundTimeperiod(timeperiod).map(timeperiodToStr);
}

// getters
const getters = {
  getActiveHistoryAroundTimeperiod: state => (timeperiod: TimePeriod) => {
    const periods = timeperiodStrsAroundTimeperiod(timeperiod);
    const _history = periods.map(tp => {
      if (_.has(state.active.history, tp)) {
        return state.active.history[tp];
      } else {
        // A zero-duration placeholder until new data has been fetched
        return [{ timestamp: moment(tp.split('/')[0]).format(), duration: 0, data: {} }];
      }
    });
    return _history;
  },
};

// actions
const actions = {
  async ensure_loaded({ commit, state, dispatch }, query_options: QueryOptions) {
    console.info('Query options: ', query_options);
    if (!state.loaded || state.query_options !== query_options || query_options.force) {
      commit('start_loading', query_options);
      if (!query_options.timeperiod) {
        query_options.timeperiod = dateToTimeperiod(query_options.date);
      }

      await dispatch('buckets/ensureBuckets', null, { root: true });
      await dispatch('get_buckets', query_options);

      // TODO: These queries can actually run in parallel, but since server won't process them in parallel anyway we won't.
      await dispatch('set_available', query_options);

      if (state.window.available) {
        await dispatch('query_desktop_full', query_options);
      } else if (state.android.available) {
        await dispatch('query_android', query_options);
      } else {
        console.log(
          'Cannot query windows as we are missing either an afk/window bucket pair or an android bucket'
        );
        await dispatch('reset_window');
        await dispatch('reset_category');
      }

      if (state.active.available) {
        await dispatch('query_active_history', query_options);
      } else if (state.android.available) {
        await dispatch('query_active_history_android', query_options);
      } else {
        console.log('Cannot call query_active_history as we do not have an afk bucket');
        await dispatch('query_active_history_empty', query_options);
      }

      if (state.editor.available) {
        await dispatch('query_editor', query_options);
      } else {
        console.log('Cannot call query_editor as we do not have any editor buckets');
        await dispatch('reset_editor');
      }

      if (state.window.available) {
        // Perform this last, as it takes the longest
        await dispatch('query_category_time_by_period', query_options);
      }
    } else {
      console.warn(
        'ensure_loaded called twice with same query_options but without query_options.force = true, skipping...'
      );
    }
  },

  async query_android({ state, commit }, { timeperiod, filterCategories }: QueryOptions) {
    const periods = [timeperiodToStr(timeperiod)];
    const classes = loadClassesForQuery();
    const q = queries.appQuery(state.buckets.android[0], classes, filterCategories);
    const data = await this._vm.$aw.query(periods, q).catch(this.errorHandler);
    commit('query_window_completed', data[0]);
  },

  async reset({ dispatch }) {
    await dispatch('reset_window');
    await dispatch('reset_browser');
    await dispatch('reset_editor');
    await dispatch('reset_category');
  },

  async reset_window({ commit }) {
    const data = {
      app_events: [],
      title_events: [],
      cat_events: [],
      active_events: [],
      duration: 0,
    };
    commit('query_window_completed', data);
  },

  async reset_browser({ commit }) {
    const data = {
      domains: [],
      urls: [],
      duration: 0,
    };
    commit('query_browser_completed', data);
  },

  async reset_editor({ commit }) {
    const data = {
      files: [],
      projects: [],
      languages: [],
    };
    commit('query_editor_completed', data);
  },

  async reset_category({ commit }) {
    const data = {
      by_period: [],
    };

    commit('query_category_time_by_period_completed', data);
  },

  async query_desktop_full(
    { state, commit, rootState, rootGetters },
    { timeperiod, filterCategories, filterAFK, includeAudible }: QueryOptions
  ) {
    const periods = [timeperiodToStr(timeperiod)];
    const classes = loadClassesForQuery();
    const q = queries.fullDesktopQuery(
      state.buckets.browser,
      state.buckets.window[0],
      state.buckets.afk[0],
      filterAFK,
      classes,
      filterCategories,
      includeAudible
    );
    const data = await this._vm.$aw.query(periods, q);

    const data_window = data[0].window;
    const data_browser = data[0].browser;

    // Set $color for categories
    data_window.cat_events = data[0].window['cat_events'].map(e => {
      const cat = rootGetters['categories/get_category'](e.data['$category']);
      e.data['$color'] = getColorFromCategory(cat, rootState.categories.classes);
      return e;
    });

    commit('query_window_completed', data_window);
    commit('query_browser_completed', data_browser);
  },

  async query_editor({ state, commit }, { timeperiod }) {
    const periods = [timeperiodToStr(timeperiod)];
    const q = queries.editorActivityQuery(state.buckets.editor);
    const data = await this._vm.$aw.query(periods, q);
    commit('query_editor_completed', data[0]);
  },

  async query_active_history({ commit, state }, { timeperiod }: QueryOptions) {
    const periods = timeperiodStrsAroundTimeperiod(timeperiod).filter(tp_str => {
      return !_.includes(state.active.history, tp_str);
    });
    const data = await this._vm.$aw.query(
      periods,
      queries.dailyActivityQuery(state.buckets.afk[0])
    );
    const active_history = _.zipObject(
      periods,
      _.map(data, pair => _.filter(pair, e => e.data.status == 'not-afk'))
    );
    commit('query_active_history_completed', { active_history });
  },

  async query_category_time_by_period(
    { commit, state },
    { timeperiod, filterCategories, filterAFK }: QueryOptions
  ) {
    // TODO: Needs to be adapted for Android
    let periods;
    if (timeperiod.length[1] == 'day') {
      periods = timeperiodsStrsHoursOfPeriod(timeperiod);
    } else if (timeperiod.length[1] == 'week' || timeperiod.length[1] == 'month') {
      periods = timeperiodsStrsDaysOfPeriod(timeperiod);
    } else {
      console.error('Unknown timeperiod');
    }
    const classes = loadClassesForQuery();
    const data = [];
    // Query one period at a time, to avoid timeout on slow queries
    for (const period of periods) {
      const result = await this._vm.$aw.query(
        [period],
        // TODO: Clean up call, pass QueryParams in fullDesktopQuery as well
        // TODO: Unify QueryOptions and QueryParams
        queries.hourlyCategoryQuery({
          bid_afk: state.buckets.afk[0],
          bid_window: state.buckets.window[0],
          bid_browsers: state.buckets.browser,
          // bid_android: state.buckets.android,
          classes: classes,
          filter_afk: filterAFK,
          filter_classes: filterCategories,
        })
      );
      data.push(result[0]);
    }
    commit('query_category_time_by_period_completed', { by_period: _.zipObject(periods, data) });
  },

  async query_active_history_android({ commit, state }, { timeperiod }: QueryOptions) {
    const periods = timeperiodStrsAroundTimeperiod(timeperiod).filter(tp_str => {
      return !_.includes(state.active.history, tp_str);
    });
    const data = await this._vm.$aw.query(
      periods,
      queries.dailyActivityQueryAndroid(state.buckets.android[0])
    );
    let active_history = _.zipObject(periods, data);
    active_history = _.mapValues(active_history, (duration, key) => {
      return [{ timestamp: key.split('/')[0], duration, data: { status: 'not-afk' } }];
    });
    commit('query_active_history_completed', { active_history });
  },

  async query_active_history_empty({ commit }) {
    const data = [];
    commit('query_active_history_completed', data);
  },

  async set_available({ commit, state }) {
    const window_available = state.buckets.afk.length > 0 && state.buckets.window.length > 0;
    const browser_available =
      state.buckets.afk.length > 0 &&
      state.buckets.window.length > 0 &&
      state.buckets.browser.length > 0;
    const active_available = state.buckets.afk.length > 0;
    const editor_available = state.buckets.editor.length > 0;
    const android_available = state.buckets.android.length > 0;
    commit('set_available', {
      window_available: window_available,
      browser_available: browser_available,
      active_available: active_available,
      editor_available: editor_available,
      android_available: android_available,
    });
  },

  async get_buckets({ commit, rootGetters }, { host }) {
    const buckets = {
      afk: rootGetters['buckets/afkBucketsByHost'](host),
      window: rootGetters['buckets/windowBucketsByHost'](host),
      android: rootGetters['buckets/androidBucketsByHost'](host),
      browser: rootGetters['buckets/browserBuckets'],
      editor: rootGetters['buckets/editorBuckets'],
    };
    console.log('Available buckets: ', buckets);
    commit('buckets', buckets);
  },

  async load_demo({ commit }) {
    // A function to load some demo data (for screenshots and stuff)
    commit('start_loading', {});

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

    commit('query_window_completed', {
      duration: _.sumBy(window_events, 'duration'),
      app_events,
      title_events,
      cat_events,
      active_events: [
        { timestamp: new Date().toISOString(), duration: 1.5 * 60 * 60, data: { afk: 'not-afk' } },
      ],
    });

    commit('browser_buckets', ['aw-watcher-firefox']);
    commit('query_browser_completed', {
      duration: _.sumBy(url_events, 'duration'),
      domains: domain_events,
      urls: url_events,
    });

    commit('editor_buckets', ['aw-watcher-vim']);
    commit('query_editor_completed', {
      duration: 30,
      files: [{ duration: 10, data: { file: 'test.py' } }],
      languages: [{ duration: 10, data: { language: 'python' } }],
      projects: [{ duration: 10, data: { project: 'aw-core' } }],
    });

    function build_active_history() {
      const active_history = {};
      let current_day = moment(get_day_start_with_offset());
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
    commit('query_active_history_completed', { active_history: build_active_history() });
  },
};

// mutations
const mutations = {
  start_loading(state, query_options: QueryOptions) {
    state.loaded = true;
    state.query_options = query_options;

    // Resets the store state while waiting for new query to finish
    state.window.top_apps = null;
    state.window.top_titles = null;

    state.browser.duration = 0;
    state.browser.top_domains = null;
    state.browser.top_urls = null;

    state.editor.duration = 0;
    state.editor.top_files = null;
    state.editor.top_languages = null;
    state.editor.top_projects = null;

    state.category.top = null;
    state.category.by_period = null;

    state.active.duration = null;

    // Ensures that active history isn't being fully reloaded on every date change
    // (see caching done in query_active_history and query_active_history_android)
    // FIXME: Better detection of when to actually clear (such as on force reload, hostname change)
    if (Object.keys(state.active.history).length === 0) {
      state.active.history = {};
    }
  },

  set_available(state, data) {
    state.window.available = data['window_available'];
    state.browser.available = data['browser_available'];
    state.active.available = data['active_available'];
    state.editor.available = data['editor_available'];
    state.category.available = data['window_available'] || data['android_available'];
    state.android.available = data['android_available'];
  },

  query_window_completed(state, data) {
    state.window.top_apps = data['app_events'];
    state.window.top_titles = data['title_events'];
    state.category.top = data['cat_events'];
    state.active.duration = data['duration'];
    state.active.events = data['active_events'];
  },

  query_browser_completed(state, data) {
    state.browser.top_domains = data.domains;
    state.browser.top_urls = data.urls;
    state.browser.duration = data.duration;

    // FIXME: This one might take up a lot of size in the request, move it to a seperate request
    // (or remove entirely, since we have the other timeline now)
    state.web_chunks = data['chunks'];
  },

  query_editor_completed(state, data) {
    state.editor.duration = data['duration'];
    state.editor.top_files = data['files'];
    state.editor.top_languages = data['languages'];
    state.editor.top_projects = data['projects'];
  },

  query_active_history_completed(state, { active_history }) {
    state.active.history = {
      ...state.active.history,
      ...active_history,
    };
  },

  query_category_time_by_period_completed(state, { by_period }) {
    state.category.by_period = by_period;
  },

  buckets(state, data) {
    state.buckets = data;
    state.buckets.loaded = true;
  },
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
