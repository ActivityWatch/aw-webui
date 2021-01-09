import * as _ from 'lodash';
import {
  saveClasses,
  loadClasses,
  defaultCategories,
  build_category_hierarchy,
} from '~/util/classes';

// initial state
const _state = {
  classes: [],
  classes_unsaved_changes: false,
};

// helper functions
function findSubtree(state, id) {
  const subtreeIds = [];
  const filtered = state.classes.filter(c => c.id == id);
  const root = filtered ? filtered[0] : null;

  function dfs(node) {
    if (node) {
      subtreeIds.push(node.id);
      node.children.forEach(c => dfs(c));
    }
  }

  dfs(root);
  return subtreeIds;
}

// getters
const getters = {
  classes_hierarchy: state => {
    const hier = build_category_hierarchy(state.classes);
    return _.sortBy(hier, [c => c.id || 0]);
  },
  all_categories: state => {
    return state.classes.map(c => {
      return { id: c.id, name: c.name };
    });
  },
  get_category_by_id: state => id => {
    const res = state.classes.filter(c => c.id === id);
    return res.length > 0 ? res[0] : null;
  },
  find_subtree: state => id => {
    return findSubtree(state, id);
  },
};

// actions
const actions = {
  async load({ commit }) {
    commit('loadClasses', await loadClasses());
  },
  async save({ state, commit }) {
    const r = await saveClasses(state.classes);
    commit('saveCompleted');
    return r;
  },
};

// mutations
const mutations = {
  loadClasses(state, classes) {
    let i = 0;
    state.classes = classes.map(c => Object.assign(c, { id: i++ }));
    state.classes_unsaved_changes = false;
  },
  updateClass(state, new_class) {
    const cls = state.classes.filter(c => c.id === new_class.id)[0];
    Object.assign(cls, new_class);

    // When a parent category is renamed, we also need to rename the children
    function updateChildren(node, depth) {
      if (node.children) {
        node.children.forEach(c => {
          c.name = node.name.concat(c.subname);
          c.depth = depth + 1;
          updateChildren(c, depth + 1);
        });
      }
    }

    updateChildren(cls, cls.depth);
    state.classes_unsaved_changes = true;
  },
  addClass(state, new_class) {
    new_class.id = _.max(_.map(state.classes, 'id')) + 1;
    state.classes.push(new_class);
    state.classes_unsaved_changes = true;
  },
  removeClass(state, cls) {
    // Remove class and all of its descendents
    const subtreeIds = findSubtree(state, cls.id);
    state.classes = state.classes.filter(c => !subtreeIds.includes(c.id));
    state.classes_unsaved_changes = true;
  },
  restoreDefaultClasses(state) {
    state.classes = defaultCategories;
    state.classes_unsaved_changes = true;
  },
  saveCompleted(state) {
    state.classes_unsaved_changes = false;
  },
};

export default {
  namespaced: true,
  state: _state,
  getters,
  actions,
  mutations,
};
