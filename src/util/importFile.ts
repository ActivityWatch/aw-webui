/**
 * Category-import file helpers.
 *
 * Android's Storage Access Framework often reports `.json` files as
 * `application/octet-stream`, empty, or `text/plain` instead of
 * `application/json`. Rejecting on MIME type alone makes in-app import
 * silently no-op (ActivityWatch/aw-android#247).
 */

export function shouldAttemptJsonImport(file: { name?: string; type?: string }): boolean {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/')) {
    return false;
  }
  if (type === 'application/json' || type === 'text/json' || type.endsWith('+json')) {
    return true;
  }
  if (/\.json$/i.test(file.name || '')) {
    return true;
  }
  // Android SAF / WebView File.type is often empty or octet-stream, sometimes
  // without a .json display name. Try parse; the caller surfaces JSON errors.
  return type === '' || type === 'application/octet-stream' || type === 'text/plain';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCategory(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { name, rule, data } = value;
  if (
    !Array.isArray(name) ||
    name.length === 0 ||
    !name.every(segment => typeof segment === 'string' && segment.length > 0) ||
    !isObject(rule)
  ) {
    return false;
  }
  // Older exports used an explicit null type for implicit parents. Do not
  // compile patterns here: malformed/blank regex strings remain editable values.
  if (rule.type !== 'none' && rule.type !== 'regex' && rule.type !== null) return false;
  if (rule.type === 'regex' && typeof rule.regex !== 'string') return false;
  if (rule.ignore_case !== undefined && typeof rule.ignore_case !== 'boolean') return false;
  for (const field of ['priority', 'weight']) {
    const number = rule[field];
    if (number !== undefined && number !== null && !Number.isFinite(number)) return false;
  }
  if (
    rule.select_keys !== undefined &&
    rule.select_keys !== null &&
    (!Array.isArray(rule.select_keys) || !rule.select_keys.every(key => typeof key === 'string'))
  ) {
    return false;
  }
  if (data !== undefined) {
    if (!isObject(data)) return false;
    if (data.color !== undefined && data.color !== null && typeof data.color !== 'string') {
      return false;
    }
    if (data.score !== undefined && data.score !== null && !Number.isFinite(data.score)) {
      return false;
    }
  }
  return true;
}

export function parseCategoryImport(text: string): { categories: unknown[]; id?: string } {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Unrecognized import format');
  }
  if (Array.isArray((parsed as { categories?: unknown }).categories)) {
    const obj = parsed as { categories: unknown[]; id?: unknown };
    // Admit the entire file before the caller stages a named import or mutates
    // legacy classes. Filtering invalid members would silently replace user data.
    if (!obj.categories.every(isCategory)) {
      throw new Error('Invalid category in import');
    }
    return {
      categories: obj.categories,
      id: typeof obj.id === 'string' ? obj.id : undefined,
    };
  }
  throw new Error('Unrecognized import format');
}
