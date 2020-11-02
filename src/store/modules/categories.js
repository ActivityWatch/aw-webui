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

// getters
const getters = {
  classes_hierarchy: state => {
    const hier = build_category_hierarchy(_.cloneDeep(state.classes));
    return _.sortBy(hier, [c => c.id || 0]);
  },
  all_categories: state => {
    return _.uniqBy(
      _.flatten(
        state.classes.map(c => {
          const l = [];
          for (let i = 1; i <= c.name.length; i++) {
            l.push(c.name.slice(0, i));
          }
          return l;
        })
      ),
      v => v.join('>>>>') // Can be any separator that doesn't appear in the category names themselves
    );
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
    console.log('Loaded classes:', state.classes);
    state.classes_unsaved_changes = false;
  },
  updateClass(state, new_class) {
    console.log('Updating class:', new_class);

    const old_class = _.cloneDeep(state.classes[new_class.id]);
    if (new_class.id === undefined || new_class.id === null) {
      new_class.id = _.max(_.map(state.classes, 'id')) + 1;
      state.classes.push(new_class);
    } else {
      Object.assign(state.classes[new_class.id], new_class);
    }

    // When a parent category is renamed, we also need to rename the children
    const parent_depth = old_class.name.length;
    _.map(state.classes, c => {
      if (_.isEqual(old_class.name, c.name.slice(0, parent_depth))) {
        c.name = new_class.name.concat(c.name.slice(parent_depth));
        console.log('Renamed child:', c.name);
      }
    });

    state.classes_unsaved_changes = true;
  },
  addClass(state, new_class) {
    new_class.id = _.max(_.map(state.classes, 'id')) + 1;
    state.classes.push(new_class);
    state.classes_unsaved_changes = true;
  },
  removeClass(state, cls) {
    state.classes = state.classes.filter(c => c.id !== cls.id);
    state.classes_unsaved_changes = true;
  },
  restoreDefaultClasses(state) {
    let i = 0;
    state.classes = defaultCategories.map(c => Object.assign(c, { id: i++ }));
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
