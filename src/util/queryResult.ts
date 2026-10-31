export function isEventLike(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const event = value as Record<string, unknown>;
  return 'timestamp' in event || 'duration' in event || 'data' in event;
}

export function isEventArray(value: unknown): boolean {
  return Array.isArray(value) && value.every(isEventLike);
}

export function formatQueryResult(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
