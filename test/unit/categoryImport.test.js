import { createPinia, setActivePinia } from 'pinia';
import CategorizationSettings from '~/views/settings/CategorizationSettings.vue';
import { useCategoryStore } from '~/stores/categories';

function importOnTop(store, id, categories) {
  const context = {
    categoryStore: store,
    pendingImportSetId: id,
    pendingImportCategories: categories,
    showImportModal: true,
  };
  CategorizationSettings.methods.onImportAddOnTop.call(context);
  return context;
}

const category = (name, regex) => ({ name: [name], rule: { type: 'regex', regex } });

let store;
beforeEach(() => {
  setActivePinia(createPinia());
  store = useCategoryStore();
  store.$patch({
    category_sets: [
      { id: 'mine', categories: [category('Work', 'code')] },
      { id: 'shared', categories: [category('Dev', 'old')] },
    ],
    active_set_ids: ['mine', 'shared'],
  });
  store.discardChanges();
});

test('re-importing an active secondary set uses its new rules without copying stale rules into mine', async () => {
  importOnTop(store, 'shared', [category('Dev', 'new')]);
  expect(store.get_category(['Dev']).rule.regex).toBe('new');
  await store.save();
  expect(store.category_sets.find(s => s.id === 'mine').categories.map(c => c.name)).toEqual([
    ['Work'],
  ]);
  store.setActiveSets(['mine']);
  expect(store.classes.map(c => c.name)).not.toContainEqual(['Dev']);
});

test('a primary-ID collision creates a separate set without replacing mine or another set', async () => {
  store.category_sets.push({ id: 'mine-imported', categories: [category('Other', 'other')] });
  importOnTop(store, 'mine', [category('Imported', 'new')]);
  expect(store.active_set_ids).toEqual(['mine', 'shared', 'mine-imported-imported']);
  expect(store.get_category(['Work']).rule.regex).toBe('code');
  expect(store.get_category(['Imported']).rule.regex).toBe('new');
  await store.save();
  expect(store.category_sets.find(s => s.id === 'mine').categories.map(c => c.name)).toEqual([
    ['Work'],
  ]);
  expect(store.category_sets.find(s => s.id === 'mine-imported').categories[0].name).toEqual([
    'Other',
  ]);
});

test('import preserves unsaved local edits and appends to existing active sets', async () => {
  store.addClass(category('Local', 'local'));
  const context = importOnTop(store, 'third', [category('Imported', 'new')]);
  expect(store.active_set_ids).toEqual(['mine', 'shared', 'third']);
  expect(store.get_category(['Local']).rule.regex).toBe('local');
  expect(store.classes_unsaved_changes).toBe(true);
  expect(context.showImportModal).toBe(false);
  expect(context.pendingImportCategories).toBeNull();
  await store.save();
  expect(store.category_sets.find(s => s.id === 'mine').categories.map(c => c.name)).toEqual([
    ['Work'],
    ['Local'],
  ]);
});
