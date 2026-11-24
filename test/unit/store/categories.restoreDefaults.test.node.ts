import { setActivePinia, createPinia } from 'pinia';

import { useCategoryStore } from '~/stores/categories';
import { defaultCategories } from '~/util/classes';

// ActivityWatch/aw-webui#1317 item 1: "Restore defaults" resets the primary set
// only. Categories from the other active sets must stay visible, including
// after the next sync (which runs on save and on set switches).
describe('restoreDefaultClasses with several active sets', () => {
  let store: ReturnType<typeof useCategoryStore>;

  function setup(tombstones?: string[]) {
    setActivePinia(createPinia());
    store = useCategoryStore();
    store.$patch({
      category_sets: [
        {
          id: 'mine',
          categories: [
            { name: ['Custom'], rule: { type: 'regex', regex: 'custom' } },
            { name: ['Work'], rule: { type: 'regex', regex: 'code' } },
          ],
          ...(tombstones ? { tombstones } : {}),
        },
        {
          id: 'shared',
          categories: [{ name: ['Hobby'], rule: { type: 'regex', regex: 'guitar' } }],
        },
      ],
      active_set_ids: ['mine'],
      classes: [],
    });
    store.discardChanges();
    store.setActiveSets(['mine', 'shared']);
  }

  const names = () => store.classes.map(c => c.name);

  test('keeps the secondary set categories and replaces the primary set with defaults', () => {
    setup();
    store.restoreDefaultClasses();

    expect(names()).toContainEqual(['Hobby']);
    expect(names()).not.toContainEqual(['Custom']);
    for (const c of defaultCategories) expect(names()).toContainEqual(c.name);
    expect(store.classes_unsaved_changes).toBe(true);
  });

  test('the next sync does not tombstone the secondary set categories', () => {
    setup();
    store.restoreDefaultClasses();
    store.setActiveSets(['mine', 'shared']);

    const mine = store.category_sets.find(s => s.id === 'mine');
    expect(mine.tombstones ?? []).not.toContain(JSON.stringify(['Hobby']));
    expect(mine.categories.map(c => c.name)).not.toContainEqual(['Hobby']);
    expect(names()).toContainEqual(['Hobby']);
    expect(store.category_sets.find(s => s.id === 'shared').categories).toHaveLength(1);
  });

  test('restoring defaults also lifts an earlier mask on a secondary category', () => {
    setup([JSON.stringify(['Hobby'])]);
    expect(names()).not.toContainEqual(['Hobby']);

    store.restoreDefaultClasses();
    expect(names()).toContainEqual(['Hobby']);
    store.setActiveSets(['mine', 'shared']);

    expect(store.category_sets.find(s => s.id === 'mine').tombstones).toBeUndefined();
    expect(names()).toContainEqual(['Hobby']);
  });
});
