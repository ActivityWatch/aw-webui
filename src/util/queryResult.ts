import moment from 'moment';

export function isEventLike(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const event = value as Record<string, unknown>;
  const validTimestamp =
    (typeof event.timestamp === 'string' &&
      moment(event.timestamp, moment.ISO_8601, true).isValid()) ||
    (event.timestamp instanceof Date && Number.isFinite(event.timestamp.getTime()));
  return (
    validTimestamp &&
    typeof event.duration === 'number' &&
    Number.isFinite(event.duration) &&
    event.data !== null &&
    typeof event.data === 'object' &&
    !Array.isArray(event.data)
  );
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
