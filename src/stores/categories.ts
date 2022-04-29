import _ from 'lodash';
import {
  saveClasses,
  loadClasses,
  defaultCategories,
  build_category_hierarchy,
  createMissingParents,
  annotate,
  Category,
} from '~/util/classes';
import { defineStore } from 'pinia';

interface State {
  classes: Category[];
  classes_unsaved_changes: boolean;
}

export const useCategoryStore = defineStore('categories', {
  state: (): State => ({
    classes: [],
    classes_unsaved_changes: false,
  }),

  // getters
  getters: {
    classes_hierarchy() {
      const hier = build_category_hierarchy(_.cloneDeep(this.classes));
      return _.sortBy(hier, [c => c.id || 0]);
    },
    all_categories(): string[][] {
      // Returns a list of category names (a list of list of strings)
      return _.uniqBy(
        _.flatten(
          this.classes.map((c: Category) => {
            const l = [];
            for (let i = 1; i <= c.name.length; i++) {
              l.push(c.name.slice(0, i));
            }
            return l;
          })
        ),
        (v: string[]) => v.join('>>>>') // Can be any separator that doesn't appear in the category names themselves
      );
    },
    get_category() {
      return (category_arr: string[]): Category => {
        if (typeof category_arr === 'string' || category_arr instanceof String)
          console.error('Passed category was string, expected array. Lookup will fail.');

        const match = this.classes.find(c => _.isEqual(c.name, category_arr));
        if (!match) {
          if (!_.isEqual(category_arr, ['Uncategorized']))
            console.error("Couldn't find category: ", category_arr);
          // fallback
          return { name: ['Uncategorized'], rule: { type: 'none' } };
        }
        return annotate(_.cloneDeep(match));
      };
    },
    get_category_by_id() {
      return (id: number) => {
        return annotate(_.cloneDeep(this.classes.find((c: Category) => c.id == id)));
      };
    },
    category_select() {
      return (insertMeta: boolean): { text: string; value?: string[] }[] => {
        // Useful for <select> elements enumerating categories
        let cats = this.all_categories;
        cats = cats
          .map((c: string[]) => {
            return { text: c.join(' > '), value: c };
          })
          .sort((a, b) => a.text > b.text);
        if (insertMeta) {
          cats = [
            { text: 'All', value: null },
            { text: 'Uncategorized', value: ['Uncategorized'] },
          ].concat(cats);
        }
        return cats;
      };
    },
  },

  actions: {
    async load() {
      this.loadClasses(await loadClasses());
    },
    async save() {
      const r = saveClasses(this.classes);
      this.saveCompleted();
      return r;
    },

    // mutations
    loadClasses(classes: Category[]) {
      classes = createMissingParents(classes);

      let i = 0;
      this.classes = classes.map(c => Object.assign(c, { id: i++ }));
      this.classes_unsaved_changes = false;
    },
    import(classes: Category[]) {
      let i = 0;
      // overwrite id even if already set
      this.classes = classes.map(c => Object.assign(c, { id: i++ }));
      this.classes_unsaved_changes = true;
    },
    updateClass(new_class: Category) {
      console.log('Updating class:', new_class);
      const old_class = this.classes.find((c: Category) => c.id === new_class.id);
      const old_name = old_class.name;
      const parent_depth = old_class.name.length;

      if (new_class.id === undefined || new_class.id === null) {
        new_class.id = _.max(_.map(this.classes, 'id')) + 1;
        this.classes.push(new_class);
      } else {
        Object.assign(old_class, new_class);
      }

      // When a parent category is renamed, we also need to rename the children
      _.map(this.classes, c => {
        if (_.isEqual(old_name, c.name.slice(0, parent_depth))) {
          c.name = new_class.name.concat(c.name.slice(parent_depth));
          console.log('Renamed child:', c.name);
        }
      });

      this.classes_unsaved_changes = true;
    },
    addClass(new_class: Category) {
      new_class.id = _.max(_.map(this.classes, 'id')) + 1;
      this.classes.push(new_class);
      this.classes_unsaved_changes = true;
    },
    removeClass(classId: number) {
      this.classes = this.classes.filter((c: Category) => c.id !== classId);
      this.classes_unsaved_changes = true;
    },
    restoreDefaultClasses() {
      let i = 0;
      this.classes = createMissingParents(defaultCategories).map(c =>
        Object.assign(c, { id: i++ })
      );
      this.classes_unsaved_changes = true;
    },
    clearAll() {
      this.classes = [];
      this.classes_unsaved_changes = true;
    },
    saveCompleted() {
      this.classes_unsaved_changes = false;
    },
  },
});
