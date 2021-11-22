import store from '~/store';
import _ from 'lodash';
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

test('modify a category after deleting another', () => {
  // Deleting a category, then modifying another with an ID subsequent to it, should not
  // cause the changes to be applied to unintended classes.
  // Test against:
  // https://github.com/ActivityWatch/activitywatch/issues/361#issuecomment-970707045
  store.commit('categories/restoreDefaultClasses');

  // Check that Image category is available
  expect(store.getters['categories/all_categories']).toContainEqual(['Work', 'Image']);

  // Delete Image category
  const image_cat = store.getters['categories/get_category'](['Work', 'Image']);
  const image_cat_id = image_cat.id;
  expect(image_cat_id).not.toBeUndefined();
  store.commit('categories/removeClass', image_cat_id);

  // Check that Image category no longer exists
  expect(store.getters['categories/all_categories']).not.toContainEqual(['Work', 'Image']);

  // Get Video category (whose ID succeeds to that of Image) and modify it
  const video_cat = store.getters['categories/get_category'](['Work', 'Video']);
  const video_cat_id = video_cat.id;
  expect(video_cat_id).not.toBeUndefined();
  expect(video_cat_id).toBeGreaterThan(image_cat_id);
  const new_video_cat = { ...video_cat, name: ['Work', 'Video2'], data: { test: true } };
  store.commit('categories/updateClass', new_video_cat);

  // Check that modification on Video was applied
  const video_2_cat = store.getters['categories/get_category_by_id'](video_cat_id);
  expect(video_2_cat.data.test).toBe(true);

  // Check that the category named "Video" no longer exists, and the category named "Video2" exists
  expect(
    store.getters['categories/all_categories'].filter(c => _.isEqual(c, ['Work', 'Video']))
  ).toHaveLength(0);
  expect(
    store.getters['categories/all_categories'].filter(c => _.isEqual(c, ['Work', 'Video2']))
  ).toHaveLength(1);
});
