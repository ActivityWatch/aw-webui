// Category scores are numbers. Older versions of the category editor saved the
// typed value as a string (ActivityWatch/aw-webui#1317), so exports and stored
// settings can contain numeric strings such as "5".
export function parseCategoryScore(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const trimmed = value.trim();
  // "1,000" could mean a decimal or grouped thousands. Preserve legacy text for
  // explicit correction rather than silently choosing either interpretation.
  if (/^[+-]?[1-9]\d{0,2},\d{3}(?:[eE][+-]?\d+)?$/.test(trimmed)) return undefined;
  // Accept ordinary comma decimals from locale keyboards, such as "1,5".
  const normalized =
    !trimmed.includes('.') && trimmed.split(',').length === 2 ? trimmed.replace(',', '.') : trimmed;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}
