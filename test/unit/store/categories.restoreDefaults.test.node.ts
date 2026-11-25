import { setActivePinia, createPinia } from 'pinia';

import { useCategoryStore } from '~/stores/categories';
import { Category, defaultCategories } from '~/util/classes';

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

  function setupRaw(
    primaryCategories: Category[],
    secondaryCategories: Category[],
    tombstones?: string[]
  ) {
    setActivePinia(createPinia());
    store = useCategoryStore();
    store.$patch({
      category_sets: [
        { id: 'mine', categories: primaryCategories, ...(tombstones ? { tombstones } : {}) },
        { id: 'shared', categories: secondaryCategories },
      ],
      active_set_ids: ['mine'],
      classes: [],
    });
    store.discardChanges();
    store.setActiveSets(['mine', 'shared']);
  }

  const names = () => store.classes.map(c => c.name);
  const primaryNames = () =>
    (store.category_sets.find(s => s.id === 'mine')?.categories ?? []).map(c => c.name);

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

  test('a secondary rule with the same name as an old primary rule is not copied into the primary set', () => {
    setupRaw(
      [
        { name: ['Custom'], rule: { type: 'regex', regex: 'custom' } },
        { name: ['Hobby'], rule: { type: 'regex', regex: 'old' } },
      ],
      [{ name: ['Hobby'], rule: { type: 'regex', regex: 'guitar' } }]
    );

    store.restoreDefaultClasses();
    store.setActiveSets(['mine', 'shared']);

    // The reset removed Hobby from the primary set, so the secondary rule must
    // not be written back into it.
    expect(primaryNames()).not.toContainEqual(['Hobby']);
    expect(names()).toContainEqual(['Hobby']);
  });

  test('a restored default survives unchecking a secondary set with an identical rule', () => {
    // Same name, rule and data as the built-in default, so provenance comparison
    // alone would treat the restored default as the secondary set's category.
    const work: Category = {
      name: ['Work'],
      rule: {
        type: 'regex',
        regex: 'Google Docs|Google Sheets|libreoffice|ReText|TextEdit|^Pages$|Obsidian',
      },
      data: { color: '#4ADE80', score: 10 },
    };
    setupRaw([{ name: ['Custom'], rule: { type: 'regex', regex: 'custom' } }], [work]);

    store.restoreDefaultClasses();
    store.setActiveSets(['mine', 'shared']);
    expect(names()).toContainEqual(['Work']);

    store.setActiveSets(['mine']);

    // Work is one of the primary set's own defaults after the reset, so it must
    // stay even though the secondary set supplied an identical copy.
    expect(primaryNames()).toContainEqual(['Work']);
    expect(names()).toContainEqual(['Work']);
  });

  test('a generated parent of a secondary category is not saved as a primary category', () => {
    setupRaw(
      [{ name: ['Custom'], rule: { type: 'regex', regex: 'custom' } }],
      [{ name: ['Hobby', 'Guitar'], rule: { type: 'regex', regex: 'guitar' } }],
      [JSON.stringify(['Hobby', 'Guitar'])]
    );

    store.restoreDefaultClasses();
    store.setActiveSets(['mine', 'shared']);

    expect(primaryNames()).not.toContainEqual(['Hobby']);

    store.setActiveSets(['mine']);

    // Hobby existed only as a generated parent of the secondary set's Guitar.
    expect(names()).not.toContainEqual(['Hobby']);
  });
});
