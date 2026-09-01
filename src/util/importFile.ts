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

export function parseCategoryImport(text: string): { categories: unknown[]; id?: string } {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Unrecognized import format');
  }
  if (Array.isArray((parsed as { categories?: unknown }).categories)) {
    const obj = parsed as { categories: unknown[]; id?: unknown };
    return {
      categories: obj.categories,
      id: typeof obj.id === 'string' ? obj.id : undefined,
    };
  }
  throw new Error('Unrecognized import format');
}
