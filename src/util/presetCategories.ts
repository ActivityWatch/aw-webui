/**
 * Preset category sets.
 *
 * Lets a build or deployment ship a category set that is active by default on a
 * fresh install, without modifying the built-in `defaultCategories`.
 *
 * This exists for distributions that ship their own categorization scheme (a
 * study build, a company-wide deployment, a locale-specific default set, ...).
 * The preset is defined entirely outside of aw-webui — nothing scheme-specific
 * belongs in this file.
 *
 * Two sources are supported, checked in this order:
 *
 *  1. `globalThis.__AW_PRESET_CATEGORY_SETS__` — set by an embedder (Tauri,
 *     Android WebView, a custom launcher) before the app boots. Useful for
 *     deployments that ship presets without rebuilding the bundle.
 *  2. `AW_PRESET_CATEGORY_SETS` — a compile-time constant, defined by webpack
 *     (`vue.config.js`) and Vite (`vite.config.js`) from the environment
 *     variable of the same name. This is the build-variant path:
 *
 *         AW_PRESET_CATEGORY_SETS="$(cat mypreset.json)" npm run build
 *
 * Both take the same payload: a JSON string (or an already-parsed value) holding
 * either a single CategorySet or an array of them:
 *
 *     [{"id": "mypreset",
 *       "categories": [{"name": ["Work"],
 *                       "rule": {"type": "regex", "regex": "^Work$"},
 *                       "data": {"color": "#0F0"}}]}]
 *
 * Behaviour of the resulting sets is defined in `loadCategories()` in
 * `~/util/classes`: preset sets are always *available*, but only activated by
 * default when the user has no stored categorization of their own.
 *
 * Malformed input is dropped with a warning rather than thrown — a broken
 * preset must never prevent the UI from starting.
 */
import type { Category, CategorySet, Rule } from '~/util/classes';
import { validateRegex } from '~/util/validate';

/** Name of the global an embedder can set to inject presets at runtime. */
export const PRESET_GLOBAL_NAME = '__AW_PRESET_CATEGORY_SETS__';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRule(raw: unknown, context: string): Rule | null {
  if (!isPlainObject(raw)) {
    console.warn(`[presets] ${context}: category is missing a rule, skipping`);
    return null;
  }
  // `null` was a valid "no rule" type in older exports
  const type = raw.type === null || raw.type === undefined ? 'none' : raw.type;
  if (type === 'none') {
    return { type: 'none' };
  }
  if (type !== 'regex') {
    console.warn(`[presets] ${context}: unknown rule type ${JSON.stringify(type)}, skipping`);
    return null;
  }
  if (typeof raw.regex !== 'string' || raw.regex.length === 0) {
    console.warn(`[presets] ${context}: regex rule without a pattern, skipping`);
    return null;
  }
  // validateRegex() also rejects patterns that only work in JavaScript: rules
  // are sent to the server-side query engine via `classes_for_query`, so a
  // JS-only pattern would break every categorized query.
  if (!validateRegex(raw.regex)) {
    console.warn(`[presets] ${context}: invalid regex ${JSON.stringify(raw.regex)}, skipping`);
    return null;
  }
  const rule: Rule = { type: 'regex', regex: raw.regex };
  if (raw.ignore_case === true) rule.ignore_case = true;
  // Inlined from classes.normalizeSelectKeys to avoid a runtime cycle
  // (classes.ts imports this module). Empty/duplicate lists are dropped so
  // the rust parser never sees `select_keys: []`.
  const selectKeys = normalizePresetSelectKeys(raw.select_keys);
  if (selectKeys) rule.select_keys = selectKeys;
  return rule;
}

function normalizePresetSelectKeys(keys: unknown): string[] | undefined {
  if (!Array.isArray(keys) || keys.length === 0) {
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

function parseCategory(raw: unknown, context: string): Category | null {
  if (!isPlainObject(raw)) {
    console.warn(`[presets] ${context}: category is not an object, skipping`);
    return null;
  }
  const name = raw.name;
  if (
    !Array.isArray(name) ||
    name.length === 0 ||
    !name.every(n => typeof n === 'string' && n.length > 0)
  ) {
    console.warn(`[presets] ${context}: category name must be a non-empty list of strings`);
    return null;
  }
  const rule = parseRule(raw.rule, `${context} category ${name.join('>')}`);
  if (rule === null) return null;

  const category: Category = { name: name as string[], rule };
  if (isPlainObject(raw.data)) category.data = { ...raw.data };
  return category;
}

function parseSet(raw: unknown, index: number): CategorySet | null {
  if (!isPlainObject(raw)) {
    console.warn(`[presets] set #${index} is not an object, skipping`);
    return null;
  }
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    console.warn(`[presets] set #${index} is missing a non-empty string id, skipping`);
    return null;
  }
  if (!Array.isArray(raw.categories)) {
    console.warn(`[presets] set "${raw.id}" has no categories list, skipping`);
    return null;
  }
  const categories = raw.categories
    .map(c => parseCategory(c, `set "${raw.id}"`))
    .filter((c): c is Category => c !== null);
  if (categories.length === 0) {
    console.warn(`[presets] set "${raw.id}" has no valid categories, skipping`);
    return null;
  }
  return { id: raw.id, categories };
}

/**
 * Parse and validate a preset payload.
 *
 * Accepts a JSON string, a single CategorySet, or a list of CategorySets.
 * Invalid entries are dropped (with a warning); never throws.
 */
export function parsePresetCategorySets(raw: unknown): CategorySet[] {
  if (raw === undefined || raw === null) return [];

  let value: unknown = raw;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return [];
    try {
      value = JSON.parse(trimmed);
    } catch (e) {
      console.error('[presets] failed to parse preset category sets as JSON, ignoring', e);
      return [];
    }
  }

  const rawSets = Array.isArray(value) ? value : [value];
  const sets: CategorySet[] = [];
  const seen = new Set<string>();
  rawSets.forEach((rawSet, i) => {
    const set = parseSet(rawSet, i);
    if (set === null) return;
    if (seen.has(set.id)) {
      console.warn(`[presets] duplicate set id "${set.id}", keeping the first one`);
      return;
    }
    seen.add(set.id);
    sets.push(set);
  });
  return sets;
}

function readRuntimeGlobal(): unknown {
  if (typeof globalThis === 'undefined') return undefined;
  return (globalThis as Record<string, unknown>)[PRESET_GLOBAL_NAME];
}

function readBuildConstant(): unknown {
  // Guarded with typeof: the constant is only defined in builds that set it
  return typeof AW_PRESET_CATEGORY_SETS !== 'undefined' ? AW_PRESET_CATEGORY_SETS : undefined;
}

let cached: CategorySet[] | null = null;

/**
 * The preset category sets this build/deployment ships, if any.
 *
 * Returns an empty list for stock builds, in which case all preset-related
 * behaviour is inert.
 */
export function getPresetCategorySets(): CategorySet[] {
  if (cached === null) {
    const runtime = readRuntimeGlobal();
    const source = runtime !== undefined && runtime !== null ? runtime : readBuildConstant();
    cached = parsePresetCategorySets(source);
    if (cached.length > 0) {
      console.info('[presets] loaded preset category sets:', cached.map(s => s.id).join(', '));
    }
  }
  // Deep enough copy to keep callers from mutating the cache
  return cached.map(s => ({
    id: s.id,
    categories: s.categories.map(c => ({ ...c, name: [...c.name], rule: { ...c.rule } })),
  }));
}

/** Drop the memoized presets. Intended for tests. */
export function clearPresetCategorySetsCache(): void {
  cached = null;
}
