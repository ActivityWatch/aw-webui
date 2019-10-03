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
  active_duration: 0,
  query_options: {},
};

// getters
const getters = {};

// actions
const actions = {
  async ensure_loaded({ commit, state, dispatch }, query_options) {
    if (!state.loaded || state.query_options !== query_options) {
      commit('start_loading', query_options);
      await dispatch('query_window', query_options);
      await dispatch('query_browser', query_options);
    }
  },

  async query_window({ commit }, { aw_client, date, host, filterAFK }) {
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
    const data = await aw_client.query(periods, q).catch(this.errorHandler);
    commit('query_window_completed', data[0]);
  },

  async query_browser({ commit }, { aw_client, host, date, browserBuckets, filterAFK }) {
    console.log(aw_client);
    if (browserBuckets) {
      const periods = [get_day_period(date)];
      const bucket_id_window = 'aw-watcher-window_' + host;
      const bucket_id_afk = 'aw-watcher-afk_' + host;
      const q = queries.browserSummaryQuery(
        browserBuckets,
        bucket_id_window,
        bucket_id_afk,
        default_limit, // this.top_web_count
        filterAFK
      );
      const data = await aw_client.query(periods, q);
      commit('query_browser_completed', data[0]);
    }
  },
};

// mutations
const mutations = {
  start_loading(state, query_options) {
    state.loaded = true;
    state.query_options = query_options;

    // Resets the store state while waiting for new query to finish
    state.top_apps = [];
    state.top_titles = [];
    state.top_domains = [];
    state.top_categories = [];
    state.active_duration = null;

    // FIXME: This one might take up a lot of size in the request, move it to a seperate request
    // (or remove entirely, since we have the other timeline now)
    state.app_chunks = [];
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

    // Again, might not be worth the size
    state.web_chunks = data['chunks'];
  },
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
