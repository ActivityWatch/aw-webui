import store from '~/store';
import { createMissingParents, defaultCategories } from '~/util/classes';

beforeEach(() => {
  store.commit('categories/clearAll');
});

test('loads default categories', () => {
  // Load categories
  expect(store.state.categories.classes).toHaveLength(0);
  store.commit('categories/restoreDefaultClasses');
  expect(store.state.categories.classes_unsaved_changes).toBeTruthy();
  store.commit('categories/saveCompleted');
  expect(store.state.categories.classes_unsaved_changes).toBeFalsy();
  expect(store.state.categories.classes).not.toHaveLength(0);

  // Retrieve class
  let workCat = store.getters['categories/get_category'](['Work']);
  expect(workCat).not.toBeUndefined();
  workCat = JSON.parse(JSON.stringify(workCat)); // copy

  // Modify class
  const newRegex = 'Just testing';
  workCat.rule.regex = newRegex;
  store.commit('categories/updateClass', workCat);
  expect(store.getters['categories/get_category'](['Work']).rule.regex).toEqual(newRegex);

  // Check that getters behave somewhat
  expect(store.getters['categories/all_categories']).not.toHaveLength(0);
  expect(store.getters['categories/classes_hierarchy']).not.toHaveLength(0);
});

test('loads custom categories', () => {
  expect(store.state.categories.classes).toHaveLength(0);
  store.commit('categories/loadClasses', [{ name: ['Test'] }]);
  expect(store.getters['categories/all_categories']).toHaveLength(1);
});

test('get category hierarchy', () => {
  store.commit('categories/restoreDefaultClasses');
  const hier = store.getters['categories/classes_hierarchy'];
  expect(hier).not.toHaveLength(0);
});

test('create missing parents', () => {
  const cats = createMissingParents([{ name: ['Test', 'Subcat'] }]);
  expect(cats).toHaveLength(2);
});

test('update implicit parent category', () => {
  // The default categories have implicit Media and Comms categories (with 'No Rule')
  // Tests against https://github.com/ActivityWatch/activitywatch/issues/580
  store.commit('categories/restoreDefaultClasses');

  // Check that the label is available
  expect(store.getters['categories/all_categories']).toContainEqual(['Media']);

  // Get category and modify it
  const media_cat = store.getters['categories/get_category'](['Media']);
  expect(media_cat.id).not.toBeUndefined();
  const new_media_cat = { ...media_cat, name: ['Media2'], data: { test: true } };
  store.commit('categories/updateClass', new_media_cat);

  // Check that category was modified correctly
  const media2_cat = store.getters['categories/get_category'](['Media2']);
  expect(media2_cat.data.test).toBe(true);

  // Check that child was modified correctly when parent name changed
  const music_cat = store.getters['categories/get_category'](['Media2', 'Music']);
  expect(music_cat.id).not.toBeUndefined();

  // Check that defaultCategories haven't mutated
  expect(defaultCategories.map(c => c.name)).toContainEqual(['Media', 'Music']);
});
