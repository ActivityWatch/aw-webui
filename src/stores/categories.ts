import _ from 'lodash';
import {
  saveCategories,
  loadCategories,
  cleanCategory,
  getDefaultClasses,
  build_category_hierarchy,
  createMissingParents,
  mergeCategorySets,
  annotate,
  Category,
  CategorySet,
  Rule,
  hasMatchableRegex,
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

/**
 * Return the active sets in priority order: `activeSetIds[0]` is the primary
 * set and wins per name, then the rest in order. The `category_sets` array
 * order is unrelated to priority, so never merge it directly.
 */
function orderedActiveSets(categorySets: CategorySet[], activeSetIds: string[]): CategorySet[] {
  return activeSetIds
    .map(id => categorySets.find(s => s.id === id))
    .filter((s): s is CategorySet => !!s);
}

/** Recompute the effective `classes` list from the provided active sets. */
function computeEffectiveClasses(categorySets: CategorySet[], activeSetIds: string[]): Category[] {
  const merged = mergeCategorySets(orderedActiveSets(categorySets, activeSetIds));
  return assignIds(createMissingParents(merged));
}

/**
 * Normalize a category for provenance comparison.
 *
 * The edit modal can attach `data: { color: undefined, score: undefined }`
 * without the user changing anything; treat an all-undefined `data` object as
 * absent so an untouched category is not mistaken for an edit.
 */
function comparableCategory(c: Category): Category {
  const clean = cleanCategory(c);
  if (clean.data) {
    const data = _.pickBy(clean.data, v => v !== undefined);
    if (Object.keys(data).length === 0) delete clean.data;
    else clean.data = data;
  }
  return clean;
}

/**
 * Copy current effective classes back into the primary active set.
 *
 * With one active set, `state.classes` is that set. With several, it is the
 * merged view (first set wins per name), so it is split back by provenance:
 * a category is kept out of the primary set only when it is an unchanged copy
 * of a secondary set's category, or a parent synthesized by
 * `createMissingParents` for one. Everything else (new categories, edits,
 * edited secondary categories, which become primary-set overrides) goes to
 * the primary set. Secondary sets are never written.
 *
 * Removed secondary names are masked by tombstones on the primary set, so
 * renames/deletions survive reload without modifying the source set.
 */
function syncToPrimarySet(state: State) {
  if (state.active_set_ids.length === 0 || state.category_sets.length === 0) return;
  const primaryId = state.active_set_ids[0];
  const primarySet = state.category_sets.find(s => s.id === primaryId);
  if (!primarySet) return;
  const current = state.classes.map(cleanCategory);
  if (state.active_set_ids.length === 1) {
    primarySet.categories = current;
    return;
  }

  const key = (c: Category) => JSON.stringify(c.name);
  const primaryNames = new Set(primarySet.categories.map(key));
  const secondary = new Map<string, Category>();
  for (const id of state.active_set_ids.slice(1)) {
    const set = state.category_sets.find(s => s.id === id);
    for (const c of set ? set.categories : []) {
      if (!secondary.has(key(c))) secondary.set(key(c), cleanCategory(c));
    }
  }
  // Parents createMissingParents adds for the merged sets, as they look untouched.
  // Merge in active_set_ids priority order so the "inherited" view matches
  // state.classes (computeEffectiveClasses) exactly.
  const merged = mergeCategorySets(orderedActiveSets(state.category_sets, state.active_set_ids));
  const mergedNames = new Set(merged.map(key));
  const currentNames = new Set(current.map(key));
  const tombstones = new Set(primarySet.tombstones ?? []);
  for (const name of secondary.keys()) {
    if (mergedNames.has(name) && !currentNames.has(name)) tombstones.add(name);
  }
  // Explicitly adding a previously hidden name restores it; changing the active
  // set selection alone leaves masks intact.
  for (const name of currentNames) tombstones.delete(name);
  if (tombstones.size > 0) primarySet.tombstones = [...tombstones];
  else delete primarySet.tombstones;
  const synthesized = new Map<string, Category>();
  for (const c of createMissingParents(_.cloneDeep(merged))) {
    if (!mergedNames.has(key(c))) synthesized.set(key(c), cleanCategory(c));
  }

  primarySet.categories = current.filter(c => {
    const k = key(c);
    if (primaryNames.has(k)) return true;
    const inherited = secondary.get(k) || synthesized.get(k);
    return !(
      inherited &&
      _.isEqual(_.omit(comparableCategory(inherited), 'id'), _.omit(comparableCategory(c), 'id'))
    );
  });
  // Masks can remove the last child of an untouched generated parent. Rebuild
  // the view now so a later save/switch cannot promote that orphan to primary.
  state.classes = computeEffectiveClasses(state.category_sets, state.active_set_ids);
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
          // Blank regexes never match (see hasMatchableRegex). Send them as
          // 'none' so every server treats them the same way.
          const rule: Rule =
            c.rule.type === 'regex' && !hasMatchableRegex(c) ? { type: 'none' } : c.rule;
          return [c.name, rule];
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

    async save(this: State) {
      // Sync current classes back to the primary active set before persisting
      syncToPrimarySet(this);
      // saveCategories already writes the legacy `classes` field. Do not also
      // call saveClasses() — the two settingsStore.update() calls raced and
      // could persist an empty/default snapshot (ActivityWatch/aw-android#247).
      if (process.env.NODE_ENV === 'test') {
        this.classes_unsaved_changes = false;
        return;
      }
      await saveCategories(this.category_sets, this.active_set_ids);
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
      // Track whether the active set actually changed so we can mark dirty only
      // when there is something to save (avoids spurious unsaved-changes prompts
      // when initialising or re-selecting the already-active set).
      const changed = this.active_set_ids.length !== 1 || this.active_set_ids[0] !== id;
      syncToPrimarySet(this);
      this.active_set_ids = [id];
      this.classes = computeEffectiveClasses(this.category_sets, this.active_set_ids);
      // When the active set changed, mark unsaved so the Save button activates
      // and the user can persist the new active_set_ids to storage.
      this.classes_unsaved_changes = changed;
    },

    /**
     * Discard unsaved in-memory edits and recompute classes from the stored sets.
     *
     * Call this before switchToSet() when the user explicitly chooses to discard
     * changes. Without this, switchToSet() would call syncToPrimarySet() first —
     * writing the discarded edits back into the set's in-memory state.
     */
    discardChanges(this: State) {
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

    /** Import a secondary set without mistaking the old effective view for local edits. */
    importSetOnTop(this: State, id: string, categories: Category[]) {
      // Preserve local edits against the old sets, before replacing any contents.
      syncToPrimarySet(this);
      const primaryId = this.active_set_ids[0];
      if (id === primaryId) {
        do {
          id += '-imported';
        } while (this.category_sets.some(s => s.id === id));
      }
      const existing = this.category_sets.find(s => s.id === id);
      if (existing) existing.categories = categories;
      else this.category_sets.push({ id, categories });
      if (!this.active_set_ids.includes(id)) this.active_set_ids.push(id);
      // Do not call setActiveSets: it would sync the stale pre-import view again.
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
      this.classes = assignIds(createMissingParents(classes));
      if (this.category_sets.length === 0) {
        const setId = this.active_set_ids[0] || 'default';
        this.category_sets = [{ id: setId, categories: [] }];
        this.active_set_ids = [setId];
      }
      // Keep the primary set in sync so save() persists the import, not defaults.
      syncToPrimarySet(this);
      this.classes_unsaved_changes = true;
    },
    updateClass(this: State, new_class: Category) {
      console.log('Updating class:', new_class);
      const old_class = this.classes.find((c: Category) => c.id === new_class.id);
      const old_name = old_class.name;
      const parent_depth = old_class.name.length;

      if (new_class.id === undefined || new_class.id === null) {
        new_class.id = (_.max(_.map(this.classes, 'id')) ?? -1) + 1;
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
    addClass(this: State, new_class: Category): number {
      new_class.id = (_.max(_.map(this.classes, 'id')) ?? -1) + 1;
      this.classes.push(new_class);
      this.classes_unsaved_changes = true;
      return new_class.id;
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
    /**
     * Reset the effective classes to the defaults of the active set.
     *
     * When the active set is one shipped by the build, "defaults" means that
     * preset — otherwise "Restore defaults" would silently drop the shipped
     * scheme. For a user-owned set it means the built-in categories: the
     * subsequent save syncs these classes into the active set, so restoring
     * anything else here would overwrite that set with another set's contents.
     */
    restoreDefaultClasses(this: State) {
      const activeId = this.active_set_ids.length > 0 ? this.active_set_ids[0] : undefined;
      this.classes = assignIds(createMissingParents(getDefaultClasses(activeId)));
      this.classes_unsaved_changes = true;
    },
    clearAll(this: State) {
      this.classes = [];
      this.classes_unsaved_changes = true;
    },
  },
});
