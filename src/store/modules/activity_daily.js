import queries from '~/queries.js';
import { loadClasses } from '~/util/classes.js';
import { get_day_period } from '~/util/time.js';

// initial state
const _state = {
  top_apps: [],
  top_titles: [],
  top_domains: [],
  top_urls: [],
  top_cats: [],
  active_duration: 0,
};

// getters
const getters = {};

// actions
const actions = {
  async query({ commit }, { date, host }) {
    commit('start_loading');
    var periods = [get_day_period(date)];
    let classes = loadClasses();
    let bucket_id_window = 'aw-watcher-window_' + host;
    let bucket_id_afk = 'aw-watcher-afk_' + host;
    var q = queries.windowQuery(
      bucket_id_window,
      bucket_id_afk,
      100, // this.top_apps_count,
      100, // this.top_windowtitles_count,
      this.filterAFK,
      classes
    );
    let data = await this.$aw.query(periods, q).catch(this.errorHandler);
    commit('query_completed', data[0]);
  },
};

// mutations
const mutations = {
  start_loading(state) {
    // Resets the store state while waiting for new query to finish
    state.top_apps = [];
    state.top_titles = [];
    state.top_domains = [];
    state.top_urls = [];
    state.top_cats = [];
  },

  query_completed(state, data) {
    this.top_apps = data['app_events'];
    this.top_windowtitles = data['title_events'];
    this.app_chunks = data['app_chunks'];
    this.top_cats = data['cat_events'];
    this.active_duration = data['duration'];
  },
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
