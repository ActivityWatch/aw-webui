import { isEqual } from 'lodash';
import { setActivePinia, createPinia } from 'pinia';

import { useCategoryStore } from '~/stores/categories';
import { createMissingParents, defaultCategories, Category } from '~/util/classes';

describe('categories store', () => {
  setActivePinia(createPinia());
  const categoryStore = useCategoryStore();

  beforeEach(() => {
    categoryStore.clearAll();
  });

  test('loads default categories', () => {
    // Load categories
    expect(categoryStore.classes).toHaveLength(0);
    categoryStore.restoreDefaultClasses();

    expect(categoryStore.classes_unsaved_changes).toBeTruthy();
    categoryStore.save();

    expect(categoryStore.classes_unsaved_changes).toBeFalsy();
    expect(categoryStore.classes).not.toHaveLength(0);

    // Retrieve class
    let workCat = categoryStore.get_category(['Work']);
    expect(workCat).not.toBeUndefined();
    workCat = JSON.parse(JSON.stringify(workCat)); // copy

    // Modify class
    const newRegex = 'Just testing';
    workCat.rule.regex = newRegex;
    categoryStore.updateClass(workCat);
    expect(categoryStore.get_category(['Work']).rule.regex).toEqual(newRegex);

    // Check that getters behave somewhat
    expect(categoryStore.all_categories).not.toHaveLength(0);
    expect(categoryStore.classes_hierarchy).not.toHaveLength(0);
  });

  test('loads custom categories', () => {
    expect(categoryStore.classes).toHaveLength(0);
    categoryStore.load([{ name: ['Test'], rule: { type: 'none' } }]);
    expect(categoryStore.all_categories).toHaveLength(1);
  });

  test('classes_for_query sends blank-regex rules as none (#382)', () => {
    categoryStore.load([
      { name: ['Work'], rule: { type: 'regex', regex: '' } },
      { name: ['Work', 'Programming'], rule: { type: 'regex', regex: 'vim' } },
    ]);
    expect(categoryStore.classes_for_query).toEqual([
      [['Work'], { type: 'none' }],
      [['Work', 'Programming'], { type: 'regex', regex: 'vim' }],
    ]);
  });

  test('updateClass preserves regex select_keys', () => {
    categoryStore.load([
      {
        name: ['Browser'],
        rule: { type: 'regex', regex: 'Firefox', select_keys: ['app'] },
      },
    ]);

    const browserCat = categoryStore.get_category(['Browser']);
    browserCat.rule.select_keys = ['title'];
    categoryStore.updateClass(browserCat);

    expect(categoryStore.get_category(['Browser']).rule.select_keys).toEqual(['title']);
  });

  test('get category hierarchy', () => {
    categoryStore.restoreDefaultClasses();
    const hier = categoryStore.classes_hierarchy;
    expect(hier).not.toHaveLength(0);
  });

  test('create missing parents', () => {
    const cats = createMissingParents([
      { name: ['Test', 'Subcat'], rule: { type: 'regex', regex: 'test' } },
    ]);
    expect(cats).toHaveLength(2);
  });

  test('update implicit parent category', () => {
    // The default categories have implicit Media and Comms categories (with 'No Rule')
    // Tests against https://github.com/ActivityWatch/activitywatch/issues/580
    categoryStore.restoreDefaultClasses();

    // Check that the label is available
    expect(categoryStore.all_categories).toContainEqual(['Media']);

    // Get category and modify it
    const media_cat: Category = categoryStore.get_category(['Media']);
    expect(media_cat.id).not.toBeUndefined();
    const new_media_cat = { ...media_cat, name: ['Media2'], data: { test: true } };
    categoryStore.updateClass(new_media_cat);

    // Check that category was modified correctly
    const media2_cat: Category = categoryStore.get_category(['Media2']);
    expect(media2_cat.data.test).toBe(true);

    // Check that child was modified correctly when parent name changed
    const music_cat = categoryStore.get_category(['Media2', 'Music']);
    expect(music_cat.id).not.toBeUndefined();

    // Check that defaultCategories haven't mutated
    expect(defaultCategories.map(c => c.name)).toContainEqual(['Media', 'Music']);
  });

  test('modify a category after deleting another', () => {
    // Deleting a category, then modifying another with an ID subsequent to it, should not
    // cause the changes to be applied to unintended classes.
    // Test against:
    // https://github.com/ActivityWatch/activitywatch/issues/361#issuecomment-970707045
    categoryStore.restoreDefaultClasses();

    // Check that Image category is available
    expect(categoryStore.all_categories).toContainEqual(['Work', 'Image']);

    // Delete Image category
    const image_cat = categoryStore.get_category(['Work', 'Image']);
    const image_cat_id = image_cat.id;
    expect(image_cat_id).not.toBeUndefined();
    categoryStore.removeClass(image_cat_id);

    // Check that Image category no longer exists
    expect(categoryStore.all_categories).not.toContainEqual(['Work', 'Image']);

    // Get Video category (whose ID succeeds to that of Image) and modify it
    const video_cat: Category = categoryStore.get_category(['Work', 'Video']);
    const video_cat_id = video_cat.id;
    expect(video_cat_id).not.toBeUndefined();
    expect(video_cat_id).toBeGreaterThan(image_cat_id);
    const new_video_cat: Category = {
      ...video_cat,
      name: ['Work', 'Video2'],
      data: { test: true },
    };
    categoryStore.updateClass(new_video_cat);

    // Check that modification on Video was applied
    const video_2_cat = categoryStore.get_category_by_id(video_cat_id);
    expect(video_2_cat.data.test).toBe(true);

    // Check that the category named "Video" no longer exists, and the category named "Video2" exists
    expect(categoryStore.all_categories.filter(c => isEqual(c, ['Work', 'Video']))).toHaveLength(0);
    expect(categoryStore.all_categories.filter(c => isEqual(c, ['Work', 'Video2']))).toHaveLength(
      1
    );
  });

  test('get_category_color decodes URL-encoded category segments', () => {
    categoryStore.load([
      {
        name: ['Work Project'],
        rule: { type: 'regex', regex: 'work-project' },
        data: { color: '#123456' },
      } as Category,
    ]);

    const decoded = categoryStore.get_category_color(['Work Project']);
    const encoded = categoryStore.get_category_color(['Work%20Project']);

    expect(decoded).toEqual('#123456');
    expect(encoded).toEqual('#123456');
  });

  test('get_category_score decodes URL-encoded category segments', () => {
    categoryStore.load([
      {
        name: ['Work Project'],
        rule: { type: 'regex', regex: 'work-project' },
        data: { score: 42 },
      } as Category,
    ]);

    const decoded = categoryStore.get_category_score(['Work Project']);
    const encoded = categoryStore.get_category_score(['Work%20Project']);

    expect(decoded).toEqual(42);
    expect(encoded).toEqual(42);
  });

  test('addClass after clearAll assigns id 0, not NaN/null', () => {
    // Regression test for #427: _.max([]) returns undefined, so
    // `_.max(_.map(this.classes, 'id')) + 1` evaluated to NaN for an empty
    // class list. JSON.stringify(NaN) produces null, creating an uneditable category.
    expect(categoryStore.classes).toHaveLength(0);
    const id = categoryStore.addClass({ name: ['New class'], rule: { type: 'none' } });
    expect(id).toBe(0);
    expect(categoryStore.classes[0].id).toBe(0);
    // Verify the new category is immediately editable (updateClass should find it by id)
    categoryStore.updateClass({ ...categoryStore.classes[0], name: ['Renamed'] });
    expect(categoryStore.classes[0].name).toEqual(['Renamed']);
  });

  test('addClass after partial deletion starts from max existing id', () => {
    categoryStore.load([
      { name: ['A'], rule: { type: 'none' } },
      { name: ['B'], rule: { type: 'none' } },
      { name: ['C'], rule: { type: 'none' } },
    ]);
    const maxBefore = Math.max(...categoryStore.classes.map(c => c.id ?? -1));
    categoryStore.removeClass(categoryStore.classes[1].id);
    const id = categoryStore.addClass({ name: ['D'], rule: { type: 'none' } });
    expect(id).toBe(maxBefore + 1);
  });

  test('import syncs classes into a primary set so save does not persist defaults', () => {
    categoryStore.category_sets = [];
    categoryStore.active_set_ids = ['default'];
    categoryStore.import([{ name: ['Work', 'Coding'], rule: { type: 'regex', regex: 'code' } }]);
    expect(categoryStore.classes_unsaved_changes).toBeTruthy();
    expect(categoryStore.category_sets).toHaveLength(1);
    expect(categoryStore.category_sets[0].id).toBe('default');
    const names = categoryStore.category_sets[0].categories.map(c => c.name);
    expect(names).toContainEqual(['Work']);
    expect(names).toContainEqual(['Work', 'Coding']);
    categoryStore.save();
    expect(categoryStore.classes_unsaved_changes).toBeFalsy();
  });

  test('switchToSet marks dirty when switching to a different set', () => {
    // Regression test for #955: switching category sets did not enable the Save
    // button because switchToSet reset classes_unsaved_changes to false even
    // though the new active_set_ids hadn't been persisted yet.
    categoryStore.$patch({
      category_sets: [
        { id: 'setA', categories: [] },
        { id: 'setB', categories: [{ name: ['Work'], rule: { type: 'none' } }] },
      ],
      active_set_ids: ['setA'],
      classes: [],
      classes_unsaved_changes: false,
    });

    categoryStore.switchToSet('setB');

    expect(categoryStore.active_set_ids).toEqual(['setB']);
    expect(categoryStore.classes_unsaved_changes).toBe(true);
  });

  test('switchToSet does not mark dirty when re-selecting the already-active set', () => {
    categoryStore.$patch({
      category_sets: [{ id: 'setA', categories: [] }],
      active_set_ids: ['setA'],
      classes: [],
      classes_unsaved_changes: false,
    });

    categoryStore.switchToSet('setA');

    expect(categoryStore.classes_unsaved_changes).toBe(false);
  });
});

describe('categories store: multiple active sets', () => {
  setActivePinia(createPinia());
  const store = useCategoryStore();
  const names = (id: string) =>
    (store.category_sets.find(s => s.id === id)?.categories ?? []).map(c => c.name);

  beforeEach(() => {
    store.$patch({
      category_sets: [
        { id: 'mine', categories: [{ name: ['Work'], rule: { type: 'regex', regex: 'code' } }] },
        {
          id: 'shared',
          categories: [{ name: ['Media', 'Video'], rule: { type: 'regex', regex: 'YouTube' } }],
        },
      ],
      active_set_ids: ['mine'],
      classes: [],
      classes_unsaved_changes: false,
    });
    store.discardChanges();
    store.setActiveSets(['mine', 'shared']);
  });

  test('shows the categories of all active sets', () => {
    const effective = store.classes.map(c => c.name);
    expect(effective).toContainEqual(['Work']);
    expect(effective).toContainEqual(['Media', 'Video']);
  });

  test('a category added while layered is saved to the primary set only', () => {
    store.addClass({ name: ['Writing'], rule: { type: 'regex', regex: 'Obsidian' } } as Category);
    store.save();
    expect(names('mine')).toEqual([['Work'], ['Writing']]);
    expect(names('shared')).toEqual([['Media', 'Video']]);
  });

  test('unchanged secondary categories and synthesized parents stay out of the primary set', () => {
    store.save();
    expect(names('mine')).toEqual([['Work']]);
  });

  test('editing a secondary category stores an override in the primary set', () => {
    const video = store.get_category(['Media', 'Video']) as Category;
    store.updateClass({ ...video, rule: { type: 'regex', regex: 'YouTube|Vimeo' } });
    store.save();
    const override = store.category_sets
      .find(s => s.id === 'mine')
      ?.categories.find(c => isEqual(c.name, ['Media', 'Video']));
    expect(override?.rule.regex).toBe('YouTube|Vimeo');
    expect(store.category_sets.find(s => s.id === 'shared')?.categories[0].rule.regex).toBe(
      'YouTube'
    );
  });

  test('primary priority is respected even when sets appear in a different array order', () => {
    // Regression: the merge used `category_sets` array order instead of
    // `active_set_ids` priority, so a checked set appearing first in the array
    // could win and overwrite the primary set's override on save.
    store.$patch({
      category_sets: [
        {
          id: 'shared',
          categories: [{ name: ['Work'], rule: { type: 'regex', regex: 'shared' } }],
        },
        { id: 'mine', categories: [{ name: ['Work'], rule: { type: 'regex', regex: 'mine' } }] },
      ],
      active_set_ids: ['mine', 'shared'],
      classes: [],
      classes_unsaved_changes: false,
    });
    store.discardChanges();

    expect(store.get_category(['Work']).rule.regex).toBe('mine');

    store.save();
    expect(store.category_sets.find(s => s.id === 'mine')?.categories[0].rule.regex).toBe('mine');
  });

  test('an edit that only adds empty data does not create a primary override', () => {
    // The edit modal adds `data: { color: undefined, score: undefined }` even
    // when nothing is changed. That must not be treated as an edit.
    const video = store.get_category(['Media', 'Video']) as Category;
    store.updateClass({ ...video, data: { color: undefined, score: undefined } });
    store.save();
    expect(names('mine')).toEqual([['Work']]);
  });
});

describe('import add-on-top via setActiveSets', () => {
  setActivePinia(createPinia());
  const store = useCategoryStore();

  beforeEach(() => {
    store.clearAll();
    store.$patch({
      category_sets: [
        {
          id: 'mine',
          categories: [{ name: ['Work'], rule: { type: 'regex', regex: 'code' } }],
        },
      ],
      active_set_ids: ['mine'],
      classes: [],
      classes_unsaved_changes: false,
    });
    store.discardChanges();
  });

  test('importing a new set on top adds it to category_sets and active_set_ids', () => {
    const importedCategories = [
      { name: ['Media', 'Video'], rule: { type: 'regex', regex: 'YouTube' } },
    ];
    store.category_sets.push({ id: 'shared', categories: importedCategories });
    store.setActiveSets(['mine', 'shared']);

    expect(store.active_set_ids).toEqual(['mine', 'shared']);
    expect(store.category_sets).toHaveLength(2);
    // Both Work (from mine) and Media/Video (from shared) are visible
    expect(store.get_category(['Work'])).toBeDefined();
    expect(store.get_category(['Media', 'Video'])).toBeDefined();
  });

  test('primary set is unchanged after adding imported set on top', () => {
    const importedCategories = [
      { name: ['Media', 'Video'], rule: { type: 'regex', regex: 'YouTube' } },
    ];
    store.category_sets.push({ id: 'shared', categories: importedCategories });
    store.setActiveSets(['mine', 'shared']);
    store.save();

    expect(store.category_sets.find(s => s.id === 'mine')?.categories).toHaveLength(1);
    expect(store.category_sets.find(s => s.id === 'mine')?.categories[0].name).toEqual(['Work']);
  });

  test('updating an existing imported set on top replaces its categories', () => {
    store.category_sets.push({
      id: 'shared',
      categories: [{ name: ['Dev'], rule: { type: 'regex', regex: 'code' } }],
    });
    store.setActiveSets(['mine', 'shared']);

    // Re-import with updated categories (simulates "Add on top" with existing set)
    const existing = store.category_sets.find(s => s.id === 'shared');
    if (existing)
      existing.categories = [{ name: ['Dev'], rule: { type: 'regex', regex: 'editor' } }];
    // active_set_ids unchanged since it already included 'shared'
    expect(store.active_set_ids).toEqual(['mine', 'shared']);
    store.discardChanges();
    expect(store.get_category(['Dev'])?.rule.regex).toBe('editor');
  });
});
