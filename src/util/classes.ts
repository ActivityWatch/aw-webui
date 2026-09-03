import _ from 'lodash';
import { IEvent } from './interfaces';
import { useSettingsStore } from '~/stores/settings';
import { getPresetCategorySets } from '~/util/presetCategories';

const level_sep = '>';
export const CLASSIFY_KEYS = ['app', 'title'] as const;
const UNCATEGORIZED = ['Uncategorized'];

/** Canonical event fields offered in the category-rule editor. */
export const CANONICAL_SELECT_KEYS = CLASSIFY_KEYS;

/** ID of the implicit set holding a user's own (non-preset) categories. */
export const DEFAULT_SET_ID = 'default';

export interface Rule {
  type: 'regex' | 'none';
  regex?: string;
  ignore_case?: boolean;
  /** When set, only these event.data keys are tested. Absent = all string fields. */
  select_keys?: string[];
}

/** Drop empty/invalid select_keys so the rust parser never sees `[]`. */
export function normalizeSelectKeys(keys?: string[] | null): string[] | undefined {
  if (!keys || keys.length === 0) {
    return undefined;
  }
  const unique: string[] = [];
  for (const key of keys) {
    if (typeof key === 'string' && key && !unique.includes(key)) {
      unique.push(key);
    }
  }
  return unique.length > 0 ? unique : undefined;
}

export interface Category {
  id?: number;
  name: string[];
  name_pretty?: string;
  subname?: string;
  rule: Rule;
  data?: Record<string, any>;
  depth?: number;
  parent?: string[];
  children?: Category[];
}

export interface CategorySet {
  id: string;
  categories: Category[];
}

/**
 * Merge multiple category sets in priority order (first set = highest priority).
 * When the same category name appears in multiple sets, the first occurrence wins.
 * Within each set, the standard specificity rule applies (deeper category wins).
 */
export function mergeCategorySets(sets: CategorySet[]): Category[] {
  const seen = new Set<string>();
  const merged: Category[] = [];
  for (const set of sets) {
    for (const cat of set.categories) {
      const key = JSON.stringify(cat.name);
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(cat);
      }
    }
  }
  return merged;
}

const COLOR_UNCAT = '#CCC';

// The default categories
// Should be run through createMissingParents before being used in most cases.
export const defaultCategories: Category[] = [
  {
    name: ['Work'],
    rule: { type: 'regex', regex: 'Google Docs|libreoffice|ReText' },
    data: { color: '#0F0', score: 10 },
  },
  {
    name: ['Work', 'Programming'],
    rule: {
      type: 'regex',
      regex: 'GitHub|Stack Overflow|BitBucket|Gitlab|vim|Spyder|kate|Ghidra|Scite',
    },
  },
  {
    name: ['Work', 'Programming', 'ActivityWatch'],
    rule: { type: 'regex', regex: 'ActivityWatch|aw-', ignore_case: true },
  },
  { name: ['Work', 'Image'], rule: { type: 'regex', regex: 'GIMP|Inkscape' } },
  { name: ['Work', 'Video'], rule: { type: 'regex', regex: 'Kdenlive' } },
  { name: ['Work', 'Audio'], rule: { type: 'regex', regex: 'Audacity' } },
  { name: ['Work', '3D'], rule: { type: 'regex', regex: 'Blender' } },
  {
    name: ['Media'],
    rule: { type: 'none' },
    data: { color: '#F33' },
  },
  {
    name: ['Media', 'Games'],
    rule: { type: 'regex', regex: 'Minecraft|RimWorld' },
    data: { color: '#F80' },
  },
  {
    name: ['Media', 'Video'],
    rule: { type: 'regex', regex: 'YouTube|Plex|VLC' },
    data: { color: '#F33' },
  },
  {
    name: ['Media', 'Social Media'],
    rule: {
      type: 'regex',
      regex: 'reddit|Facebook|Twitter|Instagram|devRant',
      ignore_case: true,
    },
    data: { color: '#FCC400' },
  },
  {
    name: ['Media', 'Music'],
    rule: {
      type: 'regex',
      regex: 'Spotify|Deezer',
      ignore_case: true,
    },
    data: { color: '#A8FC00' },
  },
  {
    name: ['Comms'],
    rule: { type: 'none' },
    data: { color: '#9FF' },
  },
  {
    name: ['Comms', 'IM'],
    rule: {
      type: 'regex',
      regex:
        'Messenger|Telegram|Signal|WhatsApp|Rambox|Slack|Riot|Element|Discord|Nheko|NeoChat|Mattermost',
    },
  },
  { name: ['Comms', 'Email'], rule: { type: 'regex', regex: 'Gmail|Thunderbird|mutt|alpine' } },
  { name: ['Uncategorized'], rule: { type: null }, data: { color: COLOR_UNCAT } },
];

/**
 * The categories a set starts out with — what "restore defaults" restores.
 *
 * Normally the built-in `defaultCategories`, but builds/deployments that ship
 * preset category sets (see `~/util/presetCategories`) start from those instead.
 *
 * `setId` is the set the categories are destined for, so that restoring never
 * writes one set's categories into another:
 *  - a preset set restores its own categories,
 *  - a user-owned set restores the built-in defaults,
 *  - omitting it (install default) uses the first preset, which is the one
 *    `loadCategories()` activates on a fresh install.
 */
export function getDefaultClasses(setId?: string): Category[] {
  const presets = getPresetCategorySets();
  if (presets.length === 0) {
    return _.cloneDeep(defaultCategories);
  }
  if (setId === undefined) {
    return presets[0].categories;
  }
  const preset = presets.find(p => p.id === setId);
  return preset ? preset.categories : _.cloneDeep(defaultCategories);
}

export function annotate(c: Category) {
  const ch = c.name;
  c.name_pretty = ch.join(level_sep);
  c.subname = ch.slice(-1)[0];
  c.parent = ch.length > 1 ? ch.slice(0, -1) : null;
  c.depth = ch.length - 1;
  return c;
}

export function createMissingParents(classes: Category[]): Category[] {
  // Creates parents for categories that are missing theirs (implicit parents)
  classes = _.cloneDeep(classes);
  classes = classes.slice().map(c => annotate(c));
  const all_full_names = new Set(classes.map(c => c.name.join(level_sep)));

  function _createMissing(children: Category[]) {
    children
      .map(c => c.parent)
      .filter(p => !!p)
      .map(p => {
        const name = p.join(level_sep);
        if (p && !all_full_names.has(name)) {
          const new_parent = annotate({ name: p, rule: { type: null } });
          //console.log('Creating missing parent:', new_parent);
          classes.push(new_parent);
          all_full_names.add(name);
          // New parent might not be top-level, so we need to recurse
          _createMissing([new_parent]);
        }
      });
  }

  _createMissing(classes);
  return classes;
}

export function build_category_hierarchy(classes: Category[]): Category[] {
  classes = createMissingParents(classes);

  function assignChildren(classes_at_level: Category[]) {
    return classes_at_level.map(cls => {
      cls.children = classes.filter(child => {
        return child.parent && cls.name
          ? JSON.stringify(child.parent) == JSON.stringify(cls.name)
          : false;
      });
      assignChildren(cls.children);
      return cls;
    });
  }

  return assignChildren(classes.filter(c => !c.parent));
}

export function flatten_category_hierarchy(hier: Category[]): Category[] {
  return _.flattenDeep(
    hier.map(h => {
      const level = [h, flatten_category_hierarchy(h.children)];
      h.children = [];
      return level;
    })
  );
}

function areWeTesting() {
  return process.env.NODE_ENV === 'test';
}

export function saveClasses(classes: Category[]) {
  if (areWeTesting()) {
    // TODO: move this into settings store?
    console.log('Not saving classes in test mode');
    return;
  }
  const settingsStore = useSettingsStore();
  settingsStore.update({ classes: classes.map(cleanCategory) });
  console.log('Saved classes', settingsStore.classes);
}

export function cleanCategory(cat: Category): Category {
  cat = _.cloneDeep(cat);
  delete cat.children;
  delete cat.parent;
  delete cat.subname;
  delete cat.name_pretty;
  delete cat.depth;
  // in an older version, type could be null (which is not allowed)
  // we also want to strip any excess properties that may have belonged to another rule type
  if (cat.rule && (cat.rule.type === null || cat.rule.type === 'none')) {
    cat.rule = { type: 'none' };
  } else if (cat.rule && cat.rule.type === 'regex') {
    const keys = normalizeSelectKeys(cat.rule.select_keys);
    if (keys) {
      cat.rule.select_keys = keys;
    } else {
      delete cat.rule.select_keys;
    }
  }
  return cat;
}

export function loadClasses(): Category[] {
  const settingsStore = useSettingsStore();
  return settingsStore.classes;
}

/**
 * Persist category sets and active set IDs to the settings store.
 * Also updates the legacy `classes` field for backwards compatibility with external readers.
 */
export function saveCategories(sets: CategorySet[], activeIds: string[]) {
  if (areWeTesting()) {
    console.log('Not saving categories in test mode');
    return;
  }
  const settingsStore = useSettingsStore();
  const cleanSets = sets.map(s => ({ ...s, categories: s.categories.map(cleanCategory) }));
  const effectiveClasses = mergeCategorySets(sets.filter(s => activeIds.includes(s.id))).map(
    cleanCategory
  );
  return settingsStore.update({
    category_sets: cleanSets,
    active_set_ids: activeIds,
    classes: effectiveClasses,
  });
}

/**
 * Load category sets and active set IDs from the settings store.
 * Falls back to the legacy flat `classes` setting if no sets are defined yet.
 *
 * Preset sets shipped by the build/deployment (see `~/util/presetCategories`)
 * are always appended as *available* sets, but are only active by default when
 * the user has no stored categorization of their own. A stored set with the
 * same id always wins over the preset definition, so user edits stick.
 */
export function loadCategories(): { sets: CategorySet[]; activeIds: string[] } {
  const settingsStore = useSettingsStore();
  const storedSets: CategorySet[] = settingsStore.category_sets;
  const storedActiveIds: string[] = settingsStore.active_set_ids;
  const presets = getPresetCategorySets();

  let sets: CategorySet[];
  let activeIds: string[];

  if (storedSets && storedSets.length > 0) {
    sets = [...storedSets];
    activeIds =
      storedActiveIds && storedActiveIds.length > 0 ? [...storedActiveIds] : [storedSets[0].id];
  } else if (presets.length > 0 && !settingsStore.hasStoredCategories) {
    // First run on a build that ships presets: activate the first preset only.
    //
    // We deliberately limit the initial selection to one set: syncToPrimarySet()
    // in the category store cannot split state.classes back into individual sets
    // when multiple sets are active, so it skips the sync entirely. Activating
    // more than one preset on first run would therefore cause any category edit
    // the user makes to be lost on the next reload.
    //
    // The remaining presets are still appended below and are available in the UI
    // for the user to activate manually.
    sets = [];
    activeIds = [presets[0].id];
  } else {
    // Migration path: no sets defined yet — wrap the existing flat classes into a "default" set
    const legacyClasses = settingsStore.classes || defaultCategories;
    sets = [{ id: DEFAULT_SET_ID, categories: legacyClasses }];
    activeIds = [DEFAULT_SET_ID];
  }

  // Presets are always offered as sets the user can switch to/combine,
  // unless a set with the same id is already stored (that one is authoritative).
  for (const preset of presets) {
    if (!sets.some(s => s.id === preset.id)) {
      sets.push(preset);
    }
  }

  // Never return a dangling or empty selection
  if (sets.length === 0) {
    sets = [{ id: DEFAULT_SET_ID, categories: defaultCategories }];
  }
  activeIds = activeIds.filter(id => sets.some(s => s.id === id));
  if (activeIds.length === 0) {
    activeIds = [sets[0].id];
  }

  return { sets, activeIds };
}

function pickDeepest(categories: Category[]) {
  return _.maxBy(categories, c => c.name.length);
}

export function matchString(
  str: string,
  categories: Category[] | null,
  event?: IEvent
): Category | null {
  if (!categories) {
    console.log(
      'Categories not passed, loading... (if you see this outside of a test, you should probably pass them)'
    );
    categories = loadClasses();
  }

  // Compile regexes
  const regexes: [Category, RegExp][] = categories
    .filter(c => c.rule.type == 'regex')
    .map(c => {
      // using 'm' flag to make `$` and `^` in rules work
      const re = RegExp(c.rule.regex, (c.rule.ignore_case ? 'i' : '') + 'm');
      return [c, re];
    });

  // Find the matching category.
  // If several categories match the event, the deepest category will be chosen.
  const matchingCats: [Category, RegExp][] = regexes.filter(([category, re]) => {
    const selectKeys = normalizeSelectKeys(category.rule.select_keys);
    if (event && selectKeys) {
      return selectKeys.some(key => {
        const value = event.data[key];
        return typeof value === 'string' && re.test(value);
      });
    }
    return re.test(str);
  });
  if (matchingCats.length > 0) {
    return pickDeepest(matchingCats.map(c => c[0]));
  }
  return null;
}

// this is used only in tests
export function classifyEvents(events: IEvent[], categories: Category[]): IEvent[] {
  const regexes: [Category, RegExp][] = categories
    .filter(c => c.rule.type == 'regex')
    .map(c => {
      const re = RegExp(c.rule.regex, c.rule.ignore_case ? 'i' : '');
      return [c, re];
    });

  return events.map((e: IEvent) => {
    const matchingCats = regexes.filter(([category, re]) => {
      const keys = normalizeSelectKeys(category.rule.select_keys) || CLASSIFY_KEYS;
      return keys.some(key => {
        const value = e.data[key];
        return typeof value === 'string' && re.test(value);
      });
    });
    e.data.$category =
      matchingCats.length > 0
        ? pickDeepest(matchingCats.map(([category]) => category)).name
        : UNCATEGORIZED;
    return e;
  });
}
