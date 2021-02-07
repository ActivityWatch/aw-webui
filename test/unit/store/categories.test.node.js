import store from '~/store';

test('loads categories', () => {
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
