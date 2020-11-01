const defaultViews = [
  {
    id: 'summary',
    name: 'Summary',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_titles', size: 3 },
      { type: 'top_domains', size: 3 },
      { type: 'top_categories', size: 3 },
      { type: 'category_tree', size: 3 },
      { type: 'category_sunburst', size: 3 },
    ],
  },
  {
    id: 'window',
    name: 'Window',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_titles', size: 3 },
    ],
  },
  {
    id: 'browser',
    name: 'Browser',
    elements: [
      { type: 'top_domains', size: 3 },
      { type: 'top_urls', size: 3 },
    ],
  },
  {
    id: 'editor',
    name: 'Editor',
    elements: [
      // TODO: Migrate ActivityEditor to ActivityView
    ],
  },
];

// initial state
const _state = {
  views: [],
};

// getters
const getters = {};

// actions
const actions = {
  async load({ commit }) {
    commit('loadViews');
  },
  async save({ state, commit }) {
    localStorage.views = JSON.stringify(state.views);
    // After save, reload views
    commit('loadViews');
  },
};

// mutations
const mutations = {
  loadViews(state) {
    const views_json = localStorage.views;
    if (views_json && views_json.length >= 1) {
      state.views = JSON.parse(views_json);
    } else {
      state.views = defaultViews;
    }
    console.log('Loaded views:', state.views);
  },
  addView(state, { view_id }) {
    state.views.push({ id: view_id, name: view_id, elements: [] });
  },
  editView(state, { view_id, el_id, type }) {
    console.log(view_id, el_id, type);
    console.log(state.views);
    state.views.find(v => v.id == view_id).elements[el_id].type = type;
  },
  addVisualization(state, { view_id, type }) {
    state.views.find(v => v.id == view_id).elements.push({ type: type });
  },
  removeVisualization(state, { view_id, el_id }) {
    state.views.find(v => v.id == view_id).elements.splice(el_id, 1);
  },
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
