// Category scores are numbers. Older versions of the category editor saved the
// typed value as a string (ActivityWatch/aw-webui#1317), so exports and stored
// settings can contain numeric strings such as "5".
export function parseCategoryScore(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  // Phone decimal keypads in comma locales produce "1,5". A single comma and no
  // period is a decimal separator, not a thousands separator (scores are small).
  const trimmed = value.trim();
  const normalized =
    !trimmed.includes('.') && trimmed.split(',').length === 2 ? trimmed.replace(',', '.') : trimmed;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : undefined;
}
