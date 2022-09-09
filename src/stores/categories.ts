import _ from 'lodash';
import {
  saveClasses,
  loadClasses,
  loadSets,
  cleanCategory,
  defaultCategories,
  build_category_hierarchy,
  createMissingParents,
  annotate,
  Category,
  Rule,
  CategorySet,
} from '~/util/classes';
import { getColorFromCategory } from '~/util/color';
import { defineStore } from 'pinia';

interface State {
  // The classes of the currently active category set
  category_set: CategorySet;

  // A list of IDs for existing category sets
  category_sets: CategorySet[];

  unsaved_changes: boolean;
}

export const useCategoryStore = defineStore('categories', {
  state: (): State => ({
    category_set: { id: '', categories: [] },
    category_sets: [],
    unsaved_changes: false,
  }),

  // getters
  getters: {
    classes_hierarchy() {
      const hier = build_category_hierarchy(_.cloneDeep(this.category_set.categories));
      return _.sortBy(hier, [c => c.id || 0]);
    },
    classes_for_query(): [string[], Rule][] {
      return this.category_set.categories
        .filter((c: Category) => c.rule.type !== null)
        .map((c: Category) => {
          return [c.name, c.rule];
        });
    },
    all_categories(): string[][] {
      // Returns a list of category names (a list of list of strings)
      return _.uniqBy(
        _.flatten(
          this.category_set.categories.map((c: Category) => {
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
    get_category(this: State) {
      return (category_arr: string[]): Category => {
        if (typeof category_arr === 'string' || category_arr instanceof String)
          console.error('Passed category was string, expected array. Lookup will fail.');

        const match = this.category_set.categories.find(c => _.isEqual(c.name, category_arr));
        if (!match) {
          if (!_.isEqual(category_arr, ['Uncategorized']))
            console.error("Couldn't find category: ", category_arr);
          // fallback
          return { name: ['Uncategorized'], rule: { type: 'none' } };
        }
        return annotate(_.cloneDeep(match));
      };
    },
    get_category_by_id(this: State) {
      return (id: number) => {
        return annotate(
          _.cloneDeep(this.category_set.categories.find((c: Category) => c.id == id))
        );
      };
    },
    get_category_color() {
      return (cat: string[]) => {
        return getColorFromCategory(this.get_category(cat), this.category_set.categories);
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
    load(this: State, category_set?: CategorySet) {
      if (category_set) {
        this.category_set = category_set;
        this.category_sets = [this.category_set];
      } else {
        // loadSets always returns the current set first
        this.category_sets = loadSets();
        this.category_set = this.category_sets[0];
      }
      this.unsaved_changes = false;
    },
    save() {
      const r = saveClasses(this.category_set);
      this.unsaved_changes = false;
      return r;
    },

    // mutations
    import(this: State, category_set: CategorySet) {
      this.category_sets.push(category_set);
      this.unsaved_changes = true;
    },
    updateClass(this: State, new_class: Category) {
      console.log('Updating class:', new_class);
      const old_class = this.category_set.categories.find((c: Category) => c.id === new_class.id);
      const old_name = old_class.name;
      const parent_depth = old_class.name.length;

      if (new_class.id === undefined || new_class.id === null) {
        new_class.id = _.max(_.map(this.category_set.categories, 'id')) + 1;
        this.category_set.categories.push(new_class);
      } else {
        Object.assign(old_class, new_class);
      }

      // When a parent category is renamed, we also need to rename the children
      _.map(this.category_set.categories, c => {
        if (_.isEqual(old_name, c.name.slice(0, parent_depth))) {
          c.name = new_class.name.concat(c.name.slice(parent_depth));
          console.log('Renamed child:', c.name);
        }
      });

      this.unsaved_changes = true;
    },
    addClass(this: State, new_class: Category) {
      new_class.id = (_.max(_.map(this.category_set.categories, 'id')) || 0) + 1;
      this.category_set.categories.push(annotate(new_class));
      this.unsaved_changes = true;
    },
    removeClass(this: State, classId: number) {
      this.category_set.categories = this.category_set.categories.filter(
        (c: Category) => c.id !== classId
      );
      this.unsaved_changes = true;
    },
    restoreDefaultClasses(this: State) {
      let i = 0;
      this.category_set.categories = createMissingParents(defaultCategories).map(c =>
        Object.assign(c, { id: i++ })
      );
      this.unsaved_changes = true;
    },
    clearAll(this: State) {
      this.category_set.categories = [];
      this.unsaved_changes = true;
    },
    createSet(id: string) {
      this.category_sets.push({ id, categories: [] });
      this.setCurrentSet(id);
      this.unsaved_changes = true;
    },
    setCurrentSet(this: State, id: string) {
      const new_set = this.category_sets.find(s => s.id === id);
      if (!new_set) {
        console.error('Could not find set with id', id);
        return;
      }
      this.category_set = new_set;
    },
  },
});
