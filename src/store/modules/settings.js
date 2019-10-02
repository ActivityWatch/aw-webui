import queries from '~/queries';
import { saveClasses, loadClasses, build_category_hierarchy } from '~/util/classes';

// initial state
const _state = {
  classes: [],
};

// getters
const getters = {
  classes_hierarchy: state => {
    // FIXME: Doing the JSON thing here is not the right way to do it, but idk how else to copy it
    return build_category_hierarchy(JSON.parse(JSON.stringify(state.classes)));
  },
};

// actions
const actions = {
  async load({ commit }) {
    commit('loadClasses', await loadClasses());
  },
  async save({ state }) {
    return saveClasses(state.classes);
  },
};

// mutations
const mutations = {
  loadClasses(state, classes) {
    state.classes = classes;
  },
  updateClass(state, { id, new_class }) {
    state.classes[id] = new_class;
  },
  addClass(state, { new_class }) {
    state.classes.push(new_class);
  },
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
