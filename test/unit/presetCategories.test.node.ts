import { setActivePinia, createPinia } from 'pinia';

import {
  parsePresetCategorySets,
  getPresetCategorySets,
  clearPresetCategorySetsCache,
  PRESET_GLOBAL_NAME,
} from '~/util/presetCategories';
import {
  loadCategories,
  mergeCategorySets,
  getDefaultClasses,
  classifyEvents,
  defaultCategories,
  Category,
  CategorySet,
} from '~/util/classes';
import { useSettingsStore } from '~/stores/settings';
import { useCategoryStore } from '~/stores/categories';

const presetSet: CategorySet = {
  id: 'study',
  categories: [
    { name: ['Music & Audio'], rule: { type: 'regex', regex: '^Music & Audio$' } },
    { name: ['Video Streaming'], rule: { type: 'regex', regex: '^Video Streaming$' } },
    { name: ['Excluded'], rule: { type: 'regex', regex: '^Excluded$' } },
  ],
};

const extraSet: CategorySet = {
  id: 'extra',
  categories: [{ name: ['Extra'], rule: { type: 'regex', regex: '^Extra$' } }],
};

function setPresetGlobal(value: unknown) {
  if (value === undefined) {
    delete (globalThis as Record<string, unknown>)[PRESET_GLOBAL_NAME];
  } else {
    (globalThis as Record<string, unknown>)[PRESET_GLOBAL_NAME] = value;
  }
  clearPresetCategorySetsCache();
}

beforeEach(() => {
  setPresetGlobal(undefined);
  setActivePinia(createPinia());
});

afterAll(() => {
  setPresetGlobal(undefined);
});

describe('parsePresetCategorySets', () => {
  test('parses a JSON string holding a list of sets', () => {
    const sets = parsePresetCategorySets(JSON.stringify([presetSet]));
    expect(sets).toHaveLength(1);
    expect(sets[0].id).toEqual('study');
    expect(sets[0].categories).toHaveLength(3);
  });

  test('accepts an already-parsed value and a single set', () => {
    expect(parsePresetCategorySets([presetSet])).toHaveLength(1);
    expect(parsePresetCategorySets(presetSet)).toHaveLength(1);
  });

  test('returns empty list for absent or empty input', () => {
    expect(parsePresetCategorySets(undefined)).toEqual([]);
    expect(parsePresetCategorySets(null)).toEqual([]);
    expect(parsePresetCategorySets('')).toEqual([]);
    expect(parsePresetCategorySets('   ')).toEqual([]);
    expect(parsePresetCategorySets('[]')).toEqual([]);
  });

  test('never throws on malformed input', () => {
    expect(parsePresetCategorySets('not json')).toEqual([]);
    expect(parsePresetCategorySets(42)).toEqual([]);
    expect(parsePresetCategorySets([{ categories: [] }])).toEqual([]);
    expect(parsePresetCategorySets([{ id: 'x' }])).toEqual([]);
    expect(parsePresetCategorySets([{ id: '', categories: [] }])).toEqual([]);
  });

  test('drops invalid categories but keeps the valid ones', () => {
    const sets = parsePresetCategorySets([
      {
        id: 'mixed',
        categories: [
          { name: ['Good'], rule: { type: 'regex', regex: '^Good$' } },
          { name: [], rule: { type: 'regex', regex: 'x' } }, // empty name
          { name: ['Bad regex'], rule: { type: 'regex', regex: '[' } }, // uncompilable
          { name: ['JS only'], rule: { type: 'regex', regex: '(?<year>\\d{4})' } }, // invalid in Python
          { name: ['No rule'] }, // missing rule
          { name: ['Weird'], rule: { type: 'glob' } }, // unknown rule type
          'nonsense',
        ],
      },
    ]);
    expect(sets).toHaveLength(1);
    expect(sets[0].categories.map(c => c.name[0])).toEqual(['Good']);
  });

  test('drops sets left without any valid category', () => {
    expect(
      parsePresetCategorySets([{ id: 'empty', categories: [{ name: ['x'], rule: { type: 42 } }] }])
    ).toEqual([]);
  });

  test('normalizes legacy null rule type to none, and keeps data/ignore_case', () => {
    const sets = parsePresetCategorySets([
      {
        id: 'set',
        categories: [
          { name: ['Parent'], rule: { type: null } },
          {
            name: ['Child'],
            rule: { type: 'regex', regex: 'x', ignore_case: true },
            data: { color: '#FFF' },
          },
        ],
      },
    ]);
    expect(sets[0].categories[0].rule).toEqual({ type: 'none' });
    expect(sets[0].categories[1].rule.ignore_case).toBe(true);
    expect(sets[0].categories[1].data).toEqual({ color: '#FFF' });
  });

  test('preserves select_keys on regex rules and drops empty/duplicate lists', () => {
    const sets = parsePresetCategorySets([
      {
        id: 'set',
        categories: [
          {
            name: ['App only'],
            rule: { type: 'regex', regex: 'Chrome', select_keys: ['app'] },
          },
          {
            name: ['Empty keys'],
            rule: { type: 'regex', regex: 'x', select_keys: [] },
          },
          {
            name: ['Dup keys'],
            rule: { type: 'regex', regex: 'x', select_keys: ['title', 'app', 'title', ''] },
          },
        ],
      },
    ]);
    expect(sets[0].categories[0].rule.select_keys).toEqual(['app']);
    expect(sets[0].categories[1].rule.select_keys).toBeUndefined();
    expect(sets[0].categories[2].rule.select_keys).toEqual(['title', 'app']);
  });

  test('keeps the first of duplicate set ids', () => {
    const sets = parsePresetCategorySets([
      presetSet,
      { id: 'study', categories: [{ name: ['Other'], rule: { type: 'none' } }] },
    ]);
    expect(sets).toHaveLength(1);
    expect(sets[0].categories).toHaveLength(3);
  });
});

describe('getPresetCategorySets', () => {
  test('is empty on a stock build', () => {
    expect(getPresetCategorySets()).toEqual([]);
  });

  test('reads presets injected on the global', () => {
    setPresetGlobal(JSON.stringify([presetSet]));
    expect(getPresetCategorySets().map(s => s.id)).toEqual(['study']);
  });

  test('does not hand out a mutable reference to its cache', () => {
    setPresetGlobal([presetSet]);
    const first = getPresetCategorySets();
    first[0].categories[0].name[0] = 'mutated';
    first[0].categories.pop();
    expect(getPresetCategorySets()[0].categories.map(c => c.name[0])).toEqual([
      'Music & Audio',
      'Video Streaming',
      'Excluded',
    ]);
  });
});

describe('mergeCategorySets', () => {
  const setA: CategorySet = {
    id: 'a',
    categories: [
      { name: ['Shared'], rule: { type: 'regex', regex: 'from-a' } },
      { name: ['OnlyA'], rule: { type: 'regex', regex: 'a' } },
    ],
  };
  const setB: CategorySet = {
    id: 'b',
    categories: [
      { name: ['Shared'], rule: { type: 'regex', regex: 'from-b' } },
      { name: ['OnlyB'], rule: { type: 'regex', regex: 'b' } },
    ],
  };

  test('first set wins on name collision', () => {
    const merged = mergeCategorySets([setA, setB]);
    const shared = merged.filter(c => c.name[0] === 'Shared');
    expect(shared).toHaveLength(1);
    expect(shared[0].rule.regex).toEqual('from-a');
  });

  test('priority follows argument order', () => {
    const merged = mergeCategorySets([setB, setA]);
    expect(merged.find(c => c.name[0] === 'Shared').rule.regex).toEqual('from-b');
  });

  test('keeps non-colliding categories from every set, in order', () => {
    const merged = mergeCategorySets([setA, setB]);
    expect(merged.map(c => c.name[0])).toEqual(['Shared', 'OnlyA', 'OnlyB']);
  });

  test('collision is on the full category path, not just the leaf name', () => {
    const merged = mergeCategorySets([
      { id: 'a', categories: [{ name: ['Work', 'Email'], rule: { type: 'regex', regex: 'a' } }] },
      { id: 'b', categories: [{ name: ['Comms', 'Email'], rule: { type: 'regex', regex: 'b' } }] },
    ]);
    expect(merged).toHaveLength(2);
  });

  test('empty input yields no categories', () => {
    expect(mergeCategorySets([])).toEqual([]);
  });
});

describe('getDefaultClasses', () => {
  test('falls back to the built-in categories without presets', () => {
    expect(getDefaultClasses()).toEqual(defaultCategories);
  });

  test('uses the preset when the build ships one', () => {
    setPresetGlobal([presetSet]);
    expect(getDefaultClasses().map(c => c.name[0])).toEqual([
      'Music & Audio',
      'Video Streaming',
      'Excluded',
    ]);
  });

  test('uses only the first preset — the one activated on a fresh install', () => {
    // Otherwise "Restore defaults" + save would fold inactive presets into the
    // active set via syncToPrimarySet().
    setPresetGlobal([presetSet, extraSet]);
    expect(getDefaultClasses().map(c => c.name[0])).not.toContain('Extra');
  });

  test('restores the categories of the named preset set', () => {
    setPresetGlobal([presetSet, extraSet]);
    expect(getDefaultClasses('extra').map(c => c.name[0])).toEqual(['Extra']);
  });

  test('restores the built-in categories for a set the build does not ship', () => {
    // Never hand one set's categories to another set — the caller writes these
    // into the active set on save.
    setPresetGlobal([presetSet, extraSet]);
    expect(getDefaultClasses('my-own-set')).toEqual(defaultCategories);
  });
});

describe('loadCategories with presets', () => {
  test('first run with no stored settings activates the presets', () => {
    setPresetGlobal([presetSet]);
    const { sets, activeIds } = loadCategories();
    expect(activeIds).toEqual(['study']);
    expect(sets.map(s => s.id)).toEqual(['study']);
  });

  test('first run with multiple presets activates only the first (syncToPrimarySet invariant)', () => {
    const presetSet2: CategorySet = {
      id: 'work',
      categories: [{ name: ['Work'], rule: { type: 'regex', regex: '^Work$' } }],
    };
    setPresetGlobal([presetSet, presetSet2]);
    const { sets, activeIds } = loadCategories();
    // Only the first preset is active on first run — activating all would break
    // syncToPrimarySet, which skips sync when multiple sets are active, causing
    // category edits to be silently lost on reload.
    expect(activeIds).toEqual(['study']);
    // Both presets are available in the UI
    expect(sets.map(s => s.id)).toEqual(['study', 'work']);
  });

  test('first run without presets keeps the legacy default set', () => {
    const { sets, activeIds } = loadCategories();
    expect(activeIds).toEqual(['default']);
    expect(sets).toHaveLength(1);
    expect(sets[0].categories).toEqual(defaultCategories);
  });

  test('a user with stored classes keeps them; presets are available but inactive', () => {
    setPresetGlobal([presetSet]);
    const myClasses: Category[] = [{ name: ['Mine'], rule: { type: 'regex', regex: 'mine' } }];
    const settingsStore = useSettingsStore();
    settingsStore.$patch({ classes: myClasses, _storedKeys: ['classes'] });

    const { sets, activeIds } = loadCategories();
    expect(activeIds).toEqual(['default']);
    expect(sets.find(s => s.id === 'default').categories).toEqual(myClasses);
    // still selectable by the user
    expect(sets.map(s => s.id)).toContain('study');
  });

  test('stored sets take precedence over a preset with the same id', () => {
    setPresetGlobal([presetSet]);
    const edited: CategorySet = {
      id: 'study',
      categories: [{ name: ['Edited'], rule: { type: 'regex', regex: 'edited' } }],
    };
    const settingsStore = useSettingsStore();
    settingsStore.$patch({
      category_sets: [edited],
      active_set_ids: ['study'],
      _storedKeys: ['category_sets', 'active_set_ids'],
    });

    const { sets, activeIds } = loadCategories();
    expect(activeIds).toEqual(['study']);
    expect(sets).toHaveLength(1);
    expect(sets[0].categories.map(c => c.name[0])).toEqual(['Edited']);
  });

  test('presets are appended to stored sets without changing the active selection', () => {
    setPresetGlobal([presetSet]);
    const settingsStore = useSettingsStore();
    settingsStore.$patch({
      category_sets: [{ id: 'mine', categories: defaultCategories }],
      active_set_ids: ['mine'],
      _storedKeys: ['category_sets'],
    });

    const { sets, activeIds } = loadCategories();
    expect(activeIds).toEqual(['mine']);
    expect(sets.map(s => s.id)).toEqual(['mine', 'study']);
  });

  test('drops active ids that no longer resolve to a set', () => {
    const settingsStore = useSettingsStore();
    settingsStore.$patch({
      category_sets: [{ id: 'mine', categories: defaultCategories }],
      active_set_ids: ['gone'],
      _storedKeys: ['category_sets'],
    });

    expect(loadCategories().activeIds).toEqual(['mine']);
  });
});

describe('categories store with presets', () => {
  test('loads preset categories on first run', () => {
    setPresetGlobal([presetSet]);
    const categoryStore = useCategoryStore();
    categoryStore.load();

    expect(categoryStore.active_set_ids).toEqual(['study']);
    expect(categoryStore.classes.map(c => c.name[0])).toEqual([
      'Music & Audio',
      'Video Streaming',
      'Excluded',
    ]);
    // ids are assigned so the editor can address them
    expect(categoryStore.classes.every(c => typeof c.id === 'number')).toBe(true);
    expect(categoryStore.classes_unsaved_changes).toBe(false);
  });

  test('rules match on app name, as written by the watcher', () => {
    setPresetGlobal([presetSet]);
    const categoryStore = useCategoryStore();
    categoryStore.load();

    const events = [
      { timestamp: new Date().toISOString(), duration: 0, data: { app: 'Video Streaming' } },
      { timestamp: new Date().toISOString(), duration: 0, data: { app: 'Something else' } },
    ];
    const classified = classifyEvents(events, categoryStore.classes);
    expect(classified[0].data.$category).toEqual(['Video Streaming']);
    expect(classified[1].data.$category).toEqual(['Uncategorized']);
  });

  test('field-scoped preset rules do not match other string fields', () => {
    setPresetGlobal([
      {
        id: 'study',
        categories: [
          {
            name: ['Docs'],
            rule: { type: 'regex', regex: 'Google Docs', select_keys: ['app'] },
          },
        ],
      },
    ]);
    const categoryStore = useCategoryStore();
    categoryStore.load();

    const events = [
      {
        timestamp: new Date().toISOString(),
        duration: 0,
        data: { app: 'Google Docs', title: 'Inbox' },
      },
      {
        timestamp: new Date().toISOString(),
        duration: 0,
        data: { app: 'Chrome', title: 'Google Docs' },
      },
    ];
    const classified = classifyEvents(events, categoryStore.classes);
    expect(classified[0].data.$category).toEqual(['Docs']);
    expect(classified[1].data.$category).toEqual(['Uncategorized']);
  });

  test('restore defaults restores the preset, not the built-in categories', () => {
    setPresetGlobal([presetSet]);
    const categoryStore = useCategoryStore();
    categoryStore.load();
    categoryStore.clearAll();
    categoryStore.restoreDefaultClasses();

    expect(categoryStore.classes.map(c => c.name[0])).toEqual([
      'Music & Audio',
      'Video Streaming',
      'Excluded',
    ]);
  });

  test('restore defaults + save keeps inactive presets out of the active set', () => {
    setPresetGlobal([presetSet, extraSet]);
    const categoryStore = useCategoryStore();
    categoryStore.load();
    categoryStore.restoreDefaultClasses();
    categoryStore.save();

    const activeSet = categoryStore.category_sets.find(s => s.id === 'study');
    expect(activeSet.categories.map(c => c.name[0])).not.toContain('Extra');
    expect(categoryStore.category_sets.find(s => s.id === 'extra').categories).toEqual(
      extraSet.categories
    );
  });

  test('restore defaults on a non-preset set does not overwrite it with a preset', () => {
    setPresetGlobal([presetSet, extraSet]);
    const settingsStore = useSettingsStore();
    settingsStore.$patch({
      category_sets: [{ id: 'mine', categories: [{ name: ['Mine'], rule: { type: 'none' } }] }],
      active_set_ids: ['mine'],
      _storedKeys: ['category_sets'],
    });
    const categoryStore = useCategoryStore();
    categoryStore.load();
    expect(categoryStore.active_set_ids).toEqual(['mine']);

    categoryStore.restoreDefaultClasses();
    categoryStore.save();

    const names = categoryStore.category_sets
      .find(s => s.id === 'mine')
      .categories.map(c => c.name[0]);
    expect(names).not.toContain('Music & Audio');
    expect(names).toContain('Work');
    // the preset sets themselves are untouched
    expect(categoryStore.category_sets.find(s => s.id === 'study').categories).toEqual(
      presetSet.categories
    );
  });

  test('restore defaults is unchanged on a stock build', () => {
    const categoryStore = useCategoryStore();
    categoryStore.restoreDefaultClasses();
    expect(categoryStore.get_category(['Work'])).toBeTruthy();
    expect(categoryStore.classes.length).toBeGreaterThan(defaultCategories.length - 1);
  });
});
