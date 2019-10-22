import moment from 'moment';
import queries from '~/queries.js';
import { loadClassesForQuery } from '~/util/classes';
import { get_day_period } from '~/util/time.js';

const default_limit = 100;

// initial state
const _state = {
  top_apps: [],
  top_titles: [],
  top_domains: [],
  top_urls: [],
  top_categories: [],
  app_chunks: [],
  web_chunks: [],
  active_duration: 0,
  active_history: {},
  query_options: {
    browser_buckets: 'all',
  },
  browser_buckets_available: [],
};

// getters
const getters = {
  getActiveHistoryAroundDate: state => date => {
    const _history = [];
    for (let i = -15; i <= 15; i++) {
      const tp = get_day_period(moment(date).add(i, 'days'));
      if (_.has(state.active_history, tp)) {
        _history.push(state.active_history[tp]);
      } else {
        // Push a zero-duration placeholder until new data has been fetched
        _history.push([{ timestamp: moment(tp.split('/')[0]).format(), duration: 0, data: {} }]);
      }
    }
    return _history;
  },
};

// actions
const actions = {
  async ensure_loaded({ commit, state, dispatch }, query_options) {
    console.info('Query options: ', query_options);
    if (!state.loaded || state.query_options !== query_options || query_options.force) {
      commit('start_loading', query_options);
      await dispatch('get_browser_buckets', query_options);

      // TODO: These queries can actually run in parallel, but since server won't process them in parallel anyway we won't.
      await dispatch('query_window', query_options);
      await dispatch('query_browser', query_options);
      await dispatch('query_active_history', query_options);
    } else {
      console.warn(
        'ensure_loaded called twice with same query_options but without query_options.force = true, skipping...'
      );
    }
  },

  async query_window({ commit }, { date, host, filterAFK }) {
    const start = moment();
    const periods = [get_day_period(date)];
    const classes = loadClassesForQuery();
    const bucket_id_window = 'aw-watcher-window_' + host;
    const bucket_id_afk = 'aw-watcher-afk_' + host;
    const q = queries.windowQuery(
      bucket_id_window,
      bucket_id_afk,
      default_limit, // this.top_apps_count,
      default_limit, // this.top_windowtitles_count,
      filterAFK,
      classes
    );
    const data = await this._vm.$aw.query(periods, q).catch(this.errorHandler);
    console.info(`Completed window query in ${moment() - start}ms`);
    commit('query_window_completed', data[0]);
  },

  async query_browser({ state, commit }, { host, date, filterAFK }) {
    const start = moment();
    if (state.browser_buckets_available) {
      const periods = [get_day_period(date)];
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
      console.info(`Completed browser query in ${moment() - start}ms`);
      commit('query_browser_completed', data[0]);
    }
  },

  async query_active_history({ commit, state }, { host, date }) {
    const start = moment();
    const timeperiods = [];
    for (let i = -15; i <= 15; i++) {
      const tp = get_day_period(moment(date).add(i, 'days'));
      if (!_.includes(state.active_history, tp)) timeperiods.push(tp);
    }
    const bucket_id_afk = 'aw-watcher-afk_' + host;
    const data = await this._vm.$aw.query(timeperiods, queries.dailyActivityQuery(bucket_id_afk));
    const active_history = _.zipObject(
      timeperiods,
      _.map(data, pair => _.filter(pair, e => e.data.status == 'not-afk'))
    );
    console.info(`Completed history query in ${moment() - start}ms`);
    commit('query_active_history_completed', { active_history });
  },

  async get_browser_buckets({ commit }) {
    let buckets = await this._vm.$aw.getBuckets();
    buckets = _.map(
      _.filter(buckets, bucket => bucket['type'] === 'web.tab.current'),
      bucket => bucket['id']
    );
    commit('browser_buckets', buckets);
  },
};

// mutations
const mutations = {
  start_loading(state, query_options) {
    state.loaded = true;
    state.query_options = query_options;

    // Resets the store state while waiting for new query to finish
    state.top_apps = null;
    state.top_titles = null;
    state.top_domains = null;
    state.top_urls = null;
    state.top_categories = null;
    state.active_duration = null;
    state.app_chunks = null;
    state.web_chunks = null;
  },

  query_window_completed(state, data) {
    state.top_apps = data['app_events'];
    state.top_titles = data['title_events'];
    state.top_categories = data['cat_events'];
    state.active_duration = data['duration'];
    state.app_chunks = data['app_chunks'];
  },

  query_browser_completed(state, data) {
    state.top_domains = data['domains'];
    state.top_urls = data['urls'];

    // FIXME: This one might take up a lot of size in the request, move it to a seperate request
    // (or remove entirely, since we have the other timeline now)
    state.web_chunks = data['chunks'];
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
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
