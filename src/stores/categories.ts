import _ from 'lodash';
import {
  saveClasses,
  saveCategories,
  loadCategories,
  cleanCategory,
  defaultCategories,
  build_category_hierarchy,
  createMissingParents,
  mergeCategorySets,
  annotate,
  Category,
  CategorySet,
  Rule,
} from '~/util/classes';
import { getColorFromCategory } from '~/util/color';
import { defineStore } from 'pinia';

interface State {
  classes: Category[];
  classes_unsaved_changes: boolean;
  // Category sets — named collections of category rules
  category_sets: CategorySet[];
  // Ordered list of active set IDs; first entry has highest priority when merging
  active_set_ids: string[];
}

function getScoreFromCategory(c: Category, allCats: Category[]): number {
  // Returns the score for a certain category, falling back to parents if none set
  // Very similar to getColorFromCategory
  if (c && c.data && c.data.score) {
    return c.data.score;
  } else if (c && c.name.slice(0, -1).length > 0) {
    // If no color is set on category, traverse parents until one is found
    const parent = c.name.slice(0, -1);
    const parentCat = allCats.find(cc => _.isEqual(cc.name, parent));
    return getScoreFromCategory(parentCat, allCats);
  } else {
    return 0;
  }
}

// Normalize URL-encoded category segments (e.g. "Work%20Project" → "Work Project").
// Route query params can arrive encoded while category names are stored decoded.
function normalizeSegments(cat: string[]): string[] {
  return (cat || []).map(segment => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
}

function assignIds(classes: Category[]): Category[] {
  let i = 0;
  return classes.map(c => Object.assign(c, { id: i++ }));
}

/** Recompute the effective `classes` list from the provided active sets. */
function computeEffectiveClasses(categorySets: CategorySet[], activeSetIds: string[]): Category[] {
  const activeSets = categorySets.filter(s => activeSetIds.includes(s.id));
  const merged = mergeCategorySets(activeSets);
  return assignIds(createMissingParents(merged));
}

/** Copy current effective classes back into the primary active set (no-op if no sets). */
function syncToPrimarySet(state: State) {
  if (state.active_set_ids.length === 0 || state.category_sets.length === 0) return;
  const primaryId = state.active_set_ids[0];
  const primarySet = state.category_sets.find(s => s.id === primaryId);
  if (primarySet) {
    primarySet.categories = state.classes.map(cleanCategory);
  }
}

export const useCategoryStore = defineStore('categories', {
  state: (): State => ({
    classes: [],
    classes_unsaved_changes: false,
    category_sets: [],
    active_set_ids: ['default'],
  }),

  // getters
  getters: {
    classes_clean(): Category[] {
      return this.classes.map(cleanCategory);
    },
    classes_hierarchy() {
      const hier = build_category_hierarchy(_.cloneDeep(this.classes));
      return _.sortBy(hier, [c => c.id || 0]);
    },
    classes_for_query(): [string[], Rule][] {
      return this.classes
        .filter(c => c.rule.type !== null)
        .map(c => {
          return [c.name, c.rule];
        });
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
    allCategoriesSelect(): { value: string[]; text: string }[] {
      const categories = this.all_categories;
      const entries = categories.map(c => {
        return { text: c.join(' > '), value: c, id: c.id };
      });
      return _.sortBy(entries, 'text');
    },
    get_category(this: State) {
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
    get_category_by_id(this: State) {
      return (id: number) => {
        return annotate(_.cloneDeep(this.classes.find((c: Category) => c.id == id)));
      };
    },
    get_category_color() {
      return (cat: string[]): string => {
        return getColorFromCategory(this.get_category(normalizeSegments(cat)), this.classes);
      };
    },
    get_category_score() {
      return (cat: string[]): number => {
        return getScoreFromCategory(this.get_category(normalizeSegments(cat)), this.classes);
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
    /**
     * Load categories into the store.
     *
     * When called with an explicit `classes` array (e.g. in tests), those categories are loaded
     * directly without touching category sets.
     *
     * When called without arguments, loads from the settings store — including multi-set support.
     * Falls back to the legacy flat `classes` setting if no sets are defined yet.
     */
    load(this: State, classes?: Category[]) {
      if (classes !== undefined) {
        // Explicit categories provided (test / programmatic path)
        classes = createMissingParents(classes);
        this.classes = assignIds(classes);
        this.classes_unsaved_changes = false;
        return;
      }

      // Load sets from settings store
      const { sets, activeIds } = loadCategories();
      this.category_sets = sets;
      this.active_set_ids = activeIds;

      // Compute effective classes from active sets (merged in priority order)
      this.classes = computeEffectiveClasses(this.category_sets, this.active_set_ids);
      this.classes_unsaved_changes = false;
    },

    save(this: State) {
      // Sync current classes back to the primary active set before persisting
      syncToPrimarySet(this);
      saveCategories(this.category_sets, this.active_set_ids);
      // Also update legacy flat classes field for backwards compatibility
      saveClasses(this.classes);
      this.classes_unsaved_changes = false;
    },

    // ── Category set management ──────────────────────────────────────────────

    /**
     * Create a new empty category set.
     * The new set is NOT activated automatically — call switchToSet() after if needed.
     */
    createSet(this: State, id: string) {
      if (this.category_sets.find(s => s.id === id)) {
        console.warn('Category set already exists:', id);
        return;
      }
      this.category_sets.push({ id, categories: [] });
    },

    /**
     * Delete a category set by ID.
     * The last remaining set cannot be deleted.
     */
    deleteSet(this: State, id: string) {
      if (this.category_sets.length <= 1) {
        console.warn('Cannot delete the last category set');
        return;
      }
      this.category_sets = this.category_sets.filter(s => s.id !== id);
      this.active_set_ids = this.active_set_ids.filter(aid => aid !== id);
      if (this.active_set_ids.length === 0) {
        this.active_set_ids = [this.category_sets[0].id];
      }
      this.classes = computeEffectiveClasses(this.category_sets, this.active_set_ids);
      this.classes_unsaved_changes = true;
    },

    /**
     * Switch to a single active set by ID.
     * Saves the current classes to the previously active set first.
     */
    switchToSet(this: State, id: string) {
      if (!this.category_sets.find(s => s.id === id)) {
        console.warn('Category set not found:', id);
        return;
      }
      syncToPrimarySet(this);
      this.active_set_ids = [id];
      this.classes = computeEffectiveClasses(this.category_sets, this.active_set_ids);
      this.classes_unsaved_changes = false;
    },

    /**
     * Set multiple active sets (combined in priority order).
     * The first ID in the list is the primary set (edits go here).
     */
    setActiveSets(this: State, ids: string[]) {
      syncToPrimarySet(this);
      this.active_set_ids = ids;
      this.classes = computeEffectiveClasses(this.category_sets, this.active_set_ids);
      this.classes_unsaved_changes = true;
    },

    /**
     * Rename a category set.
     */
    renameSet(this: State, oldId: string, newId: string) {
      if (newId === oldId) return;
      if (this.category_sets.find(s => s.id === newId)) {
        console.warn('A set with that name already exists:', newId);
        return;
      }
      const set = this.category_sets.find(s => s.id === oldId);
      if (!set) {
        console.warn('Category set not found:', oldId);
        return;
      }
      set.id = newId;
      this.active_set_ids = this.active_set_ids.map(id => (id === oldId ? newId : id));
      this.classes_unsaved_changes = true;
    },

    // ── Legacy mutations (operate on the effective `classes` list) ───────────

    // mutations
    import(this: State, classes: Category[]) {
      let i = 0;
      // overwrite id even if already set
      this.classes = classes.map(c => Object.assign(c, { id: i++ }));
      this.classes_unsaved_changes = true;
    },
    updateClass(this: State, new_class: Category) {
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

      // When a parent category is renamed, we also need to rename the children.
      // Only match categories strictly longer than old_name (actual children),
      // not siblings with the same name (fixes #702).
      _.map(this.classes, c => {
        if (
          c.id !== new_class.id &&
          c.name.length > parent_depth &&
          _.isEqual(old_name, c.name.slice(0, parent_depth))
        ) {
          c.name = new_class.name.concat(c.name.slice(parent_depth));
          console.log('Renamed child:', c.name);
        }
      });

      this.classes_unsaved_changes = true;
    },
    addClass(this: State, new_class: Category) {
      new_class.id = _.max(_.map(this.classes, 'id')) + 1;
      this.classes.push(new_class);
      this.classes_unsaved_changes = true;
    },
    removeClass(this: State, classId: number) {
      this.classes = this.classes.filter((c: Category) => c.id !== classId);
      this.classes_unsaved_changes = true;
    },
    appendClassRule(this: State, classId: number, pattern: string) {
      const cat = this.classes.find((c: Category) => c.id === classId);
      if (cat.rule.type === 'none' || cat.rule.type === null) {
        cat.rule.type = 'regex';
        cat.rule.regex = pattern;
      } else if (cat.rule.type === 'regex') {
        cat.rule.regex += '|' + pattern;
      }
      this.classes_unsaved_changes = true;
    },
    restoreDefaultClasses(this: State) {
      this.classes = assignIds(createMissingParents(defaultCategories));
      this.classes_unsaved_changes = true;
    },
    clearAll(this: State) {
      this.classes = [];
      this.classes_unsaved_changes = true;
    },
  },
});
