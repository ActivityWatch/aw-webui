export function parseThresholds(input: string): number[] | null {
  const values = input.split(',').map(s => s.trim());
  if (values.some(part => !/^[1-9]\d*$/.test(part))) {
    return null;
  }
  return values.map(Number);
}
