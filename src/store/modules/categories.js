import _ from 'lodash';
import {
  saveClasses,
  loadClasses,
  defaultCategories,
  build_category_hierarchy,
  createMissingParents,
  annotate,
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
    // Returns a list of category names (a list of list of strings)
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
  get_category: state => category_arr => {
    const match = state.classes.find(c => _.isEqual(c.name, category_arr));
    if (!match) {
      if (!_.equals(category_arr, ['Uncategorized']))
        console.error("Couldn't find category: ", category_arr);
      // fallback
      return { name: ['Uncategorized'] };
    }
    return annotate(_.cloneDeep(match));
  },
  get_category_by_id: state => id => {
    return annotate(_.cloneDeep(state.classes.find(c => c.id == id)));
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
    classes = createMissingParents(classes);

    let i = 0;
    state.classes = classes.map(c => Object.assign(c, { id: i++ }));
    state.classes_unsaved_changes = false;
  },
  import(state, classes) {
    let i = 0;
    // overwrite id even if already set
    state.classes = classes.map(c => Object.assign(c, { id: i++ }));
    state.classes_unsaved_changes = true;
  },
  updateClass(state, new_class) {
    console.log('Updating class:', new_class);
    const old_class = state.classes.find(c => c.id === new_class.id);
    const old_name = old_class.name;
    const parent_depth = old_class.name.length;

    if (new_class.id === undefined || new_class.id === null) {
      new_class.id = _.max(_.map(state.classes, 'id')) + 1;
      state.classes.push(new_class);
    } else {
      Object.assign(old_class, new_class);
    }

    // When a parent category is renamed, we also need to rename the children
    _.map(state.classes, c => {
      if (_.isEqual(old_name, c.name.slice(0, parent_depth))) {
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
  removeClass(state, classId) {
    state.classes = state.classes.filter(c => c.id !== classId);
    state.classes_unsaved_changes = true;
  },
  restoreDefaultClasses(state) {
    let i = 0;
    state.classes = createMissingParents(defaultCategories).map(c => Object.assign(c, { id: i++ }));
    state.classes_unsaved_changes = true;
  },
  clearAll(state) {
    state.classes = [];
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
