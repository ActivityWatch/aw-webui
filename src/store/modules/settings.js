import * as _ from 'lodash';
import { saveClasses, loadClasses, build_category_hierarchy } from '~/util/classes';

// initial state
const _state = {
  classes: [],
};

// getters
const getters = {
  classes_hierarchy: state => {
    return build_category_hierarchy(_.cloneDeep(state.classes));
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
  async save({ state }) {
    return saveClasses(state.classes);
  },
};

// mutations
const mutations = {
  loadClasses(state, classes) {
    let i = 0;
    state.classes = classes.map(c => Object.assign(c, { id: i++ }));
    console.log(state.classes);
  },
  updateClass(state, new_class) {
    console.log('Updating class:', new_class);
    if (new_class.id === undefined) {
      new_class.id = _.maxBy(state.classes, c => c.id) + 1;
      state.classes.push(new_class);
    } else {
      state.classes[new_class.id] = new_class;
    }
  },
  addClass(state, new_class) {
    new_class.id = _.maxBy(state.classes, c => c.id) + 1;
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
