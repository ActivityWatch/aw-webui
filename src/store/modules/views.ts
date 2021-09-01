interface Element {
  type: string;
  size?: number;
  props?: object;
}

interface View {
  id: string;
  name: string;
  elements: Element[];
}

const desktopViews: View[] = [
  {
    id: 'summary',
    name: 'Summary',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_titles', size: 3 },
      { type: 'timeline_barchart', size: 3 },
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
      { type: 'top_editor_files', size: 3 },
      { type: 'top_editor_projects', size: 3 },
      { type: 'top_editor_languages', size: 3 },
    ],
  },
];

const androidViews = [
  {
    id: 'summary',
    name: 'Summary',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_categories', size: 3 },
      { type: 'timeline_barchart', size: 3 },
      { type: 'category_tree', size: 3 },
      { type: 'category_sunburst', size: 3 },
    ],
  },
];

// FIXME: Decide depending on what kind of device is being viewed, not from which device it is being viewed.
const defaultViews = !process.env.VUE_APP_ON_ANDROID ? desktopViews : androidViews;

interface State {
  views: View[];
}

// initial state
const _state: State = {
  views: [],
};

// getters
const getters = {};

// actions
const actions = {
  async load({ commit }) {
    let views: View[];
    if (typeof localStorage !== 'undefined') {
      const views_json = localStorage.views;
      if (views_json && views_json.length >= 1) {
        views = JSON.parse(views_json);
      }
    }
    if (!views) {
      views = defaultViews;
    }
    commit('loadViews', views);
  },
  async save({ state, dispatch }) {
    localStorage.views = JSON.stringify(state.views);
    // After save, reload views from localStorage
    await dispatch('load');
  },
};

// mutations
const mutations = {
  loadViews(state: State, views: View[]) {
    state.views = views;
    console.log('Loaded views:', state.views);
  },
  clearViews(state: State) {
    state.views = [];
  },
  setElements(state: State, { view_id, elements }) {
    state.views.find(v => v.id == view_id).elements = elements;
  },
  restoreDefaults(state: State) {
    state.views = defaultViews;
  },
  addView(state: State, view: View) {
    state.views.push({ ...view, elements: [] });
  },
  removeView(state: State, { view_id }) {
    const idx = state.views.map(v => v.id).indexOf(view_id);
    state.views.splice(idx, 1);
  },
  editView(state: State, { view_id, el_id, type, props }) {
    console.log(view_id, el_id, type, props);
    console.log(state.views);
    const element = state.views.find(v => v.id == view_id).elements[el_id];
    element.type = type;
    element.props = props;
  },
  addVisualization(state: State, { view_id, type }) {
    state.views.find(v => v.id == view_id).elements.push({ type: type });
  },
  removeVisualization(state: State, { view_id, el_id }) {
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
