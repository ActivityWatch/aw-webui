// Category scores are numbers. Older versions of the category editor saved the
// typed value as a string (ActivityWatch/aw-webui#1317), so exports and stored
// settings can contain numeric strings such as "5".
export function parseCategoryScore(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}
