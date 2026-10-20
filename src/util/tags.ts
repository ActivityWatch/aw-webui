// Commas are a UI delimiter only. Events store portable JSON arrays.
export function parseTags(text: string): string[] {
  return text
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}
