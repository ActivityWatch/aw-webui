import moment from 'moment';
import { unitOfTime } from 'moment';
import * as _ from 'lodash';
import queries from '~/queries';
import { loadClassesForQuery } from '~/util/classes';
import { get_day_start_with_offset } from '~/util/time';

const default_limit = 100;

interface TimePeriod {
  start: string;
  length: [number, string];
}

function dateToTimeperiod(date: string): TimePeriod {
  return { start: get_day_start_with_offset(date), length: [1, 'day'] };
}

function timeperiodToStr(tp: TimePeriod): string {
  const start = moment(tp.start).format();
  const end = moment(start).add(tp.length[0], tp.length[1] as moment.unitOfTime.DurationConstructor).format()
  return [start, end].join("/");
}

interface QueryOptions {
  host: string;
  date?: string;
  timeperiod?: TimePeriod;
  filterAFK?: boolean;
  filterCategories?: string[][];
  force?: boolean;
}

// initial state
const _state = {
  top_apps: [],
  top_titles: [],

  browser_duration: [],
  top_domains: [],
  top_urls: [],

  editor_duration: [],
  top_editor_files: [],
  top_editor_languages: [],
  top_editor_projects: [],

  top_categories: [],
  active_events: [],
  active_duration: 0,
  active_history: {},
  query_options: {
    browser_buckets: 'all',
    editor_buckets: 'all',
  },
  editor_buckets_available: [],
  browser_buckets_available: [],
};

function timeperiodsAroundTimeperiod(timeperiod: TimePeriod): TimePeriod[] {
  const periods = [];
  for (let i = -15; i <= 15; i++) {
    const start = moment(timeperiod.start)
      .add(i * timeperiod.length[0], timeperiod.length[1] as moment.unitOfTime.DurationConstructor)
      .format();
    periods.push({...timeperiod, start});
  }
  return periods;
}

function timeperiodStrsAroundTimeperiod(timeperiod: TimePeriod): string[] {
  return timeperiodsAroundTimeperiod(timeperiod).map(timeperiodToStr);
}

// getters
const getters = {
  getActiveHistoryAroundTimeperiod: state => (timeperiod: TimePeriod) => {
    const periods = timeperiodStrsAroundTimeperiod(timeperiod);
    const _history = periods.map(tp => {
      if (_.has(state.active_history, tp)) {
        return state.active_history[tp];
      } else {
        // A zero-duration placeholder until new data has been fetched
        return [{ timestamp: moment(tp.split('/')[0]).format(), duration: 0, data: {} }];
      }
    })
    return _history;
  },
};

// actions
const actions = {
  async ensure_loaded({ commit, state, dispatch }, query_options: QueryOptions) {
    console.info('Query options: ', query_options);
    if (!state.loaded || state.query_options !== query_options || query_options.force) {
      commit('start_loading', query_options);
      if(!query_options.timeperiod) {
        query_options.timeperiod = dateToTimeperiod(query_options.date);
      }
      await dispatch('get_buckets', query_options);

      // TODO: These queries can actually run in parallel, but since server won't process them in parallel anyway we won't.
      await dispatch('query_window', query_options);
      await dispatch('query_browser', query_options);
      await dispatch('query_editor', query_options);
      await dispatch('query_active_history', query_options);
    } else {
      console.warn(
        'ensure_loaded called twice with same query_options but without query_options.force = true, skipping...'
      );
    }
  },

  async query_window({ commit }, { host, timeperiod, filterAFK, filterCategories }: QueryOptions) {
    const start = moment();
    const periods = [timeperiodToStr(timeperiod)];
    const classes = loadClassesForQuery();
    const bucket_id_window = 'aw-watcher-window_' + host;
    const bucket_id_afk = 'aw-watcher-afk_' + host;
    const q = queries.windowQuery(
      bucket_id_window,
      bucket_id_afk,
      default_limit, // this.top_apps_count,
      default_limit, // this.top_windowtitles_count,
      filterAFK,
      classes,
      filterCategories,
    );
    const data = await this._vm.$aw.query(periods, q);
    console.info(`Completed window query in ${moment().diff(start)}ms`);
    commit('query_window_completed', data[0]);
  },

  async query_browser({ state, commit }, { host, timeperiod, filterAFK }: QueryOptions) {
    const start = moment();
    if (state.browser_buckets_available) {
      const periods = [timeperiodToStr(timeperiod)];
      const bucket_id_window = 'aw-watcher-window_' + host;
      const bucket_id_afk = 'aw-watcher-afk_' + host;
      const q = queries.browserSummaryQuery(
        state.browser_buckets_available,
        bucket_id_window,
        bucket_id_afk,
        default_limit, // this.top_web_count
        filterAFK
      );
      const data = await this._vm.$aw.query(periods, q);
      console.info(`Completed browser query in ${moment().diff(start)}ms`);
      commit('query_browser_completed', data[0]);
    }
  },

  async query_editor({ state, commit }, { timeperiod }) {
    if (state.editor_buckets_available) {
      const periods = [timeperiodToStr(timeperiod)];
      const q = queries.editorActivityQuery(state.editor_buckets_available, 100);
      const data = (await this._vm.$aw.query(periods, q).catch(this.errorHandler));
      commit('query_editor_completed', data[0]);
    }
  },

  async query_active_history({ commit, state }, { host, timeperiod }: QueryOptions) {
    const periods = timeperiodStrsAroundTimeperiod(timeperiod).filter(tp_str => {
      return !_.includes(state.active_history, tp_str);
    });
    console.log(periods);
    const bucket_id_afk = 'aw-watcher-afk_' + host;
    const queryStart = moment();
    const data = await this._vm.$aw.query(periods, queries.dailyActivityQuery(bucket_id_afk));
    const active_history = _.zipObject(
      periods,
      _.map(data, pair => _.filter(pair, e => e.data.status == 'not-afk'))
    );
    console.info(`Completed history query in ${moment().diff(queryStart)}ms`);
    commit('query_active_history_completed', { active_history });
  },

  async get_buckets({ commit }) {
    const buckets = await this._vm.$aw.getBuckets();
    const browser_buckets = _.map(
      _.filter(buckets, bucket => bucket['type'] === 'web.tab.current'),
      bucket => bucket['id']
    );
    const editor_buckets = _.map(
      _.filter(buckets, bucket => bucket['type'] === 'app.editor.activity'),
      bucket => bucket['id']
    );
    commit('browser_buckets', browser_buckets);
    commit('editor_buckets', editor_buckets);
  },
};

// mutations
const mutations = {
  start_loading(state, query_options: QueryOptions) {
    state.loaded = true;
    state.query_options = query_options;

    // Resets the store state while waiting for new query to finish
    state.top_apps = null;
    state.top_titles = null;

    state.browser_duration = 0;
    state.top_domains = null;
    state.top_urls = null;

    state.editor_duration = 0;
    state.top_editor_files = null,
    state.top_editor_languages = null,
    state.top_editor_projects = null,

    state.top_categories = null;
    state.active_duration = null;
    state.active_events = null;
  },

  query_window_completed(state, data) {
    state.top_apps = data['app_events'];
    state.top_titles = data['title_events'];
    state.top_categories = data['cat_events'];
    state.active_duration = data['duration'];
    state.app_chunks = data['app_chunks'];
    state.active_events = data['active_events'];
    console.log(state.active_events);
  },

  query_browser_completed(state, data) {
    state.top_domains = data['domains'];
    state.top_urls = data['urls'];
    state.browser_duration = data['duration'];

    // FIXME: This one might take up a lot of size in the request, move it to a seperate request
    // (or remove entirely, since we have the other timeline now)
    state.web_chunks = data['chunks'];
  },

  query_editor_completed(state, data) {
    state.editor_duration = data["duration"];
    state.top_editor_files = data["files"];
    state.top_editor_languages = data["languages"];
    state.top_editor_projects = data["projects"];
  },

  query_active_history_completed(state, { active_history }) {
    state.active_history = {
      ...state.active_history,
      ...active_history,
    };
  },

  browser_buckets(state, data) {
    state.browser_buckets_available = data;
  },

  editor_buckets(state, data) {
    state.editor_buckets_available = data;
  },
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
