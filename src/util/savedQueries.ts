import moment, { Moment } from 'moment';

export interface SavedQuery {
  id: string;
  name: string;
  query_code: string;
  start_day_offset?: number;
  end_day_offset?: number;
  // Legacy hour-based offsets are kept as read-only fallbacks for already-saved presets.
  start_offset?: number;
  end_offset?: number;
  event_type?: string;
}

function referenceDay(now: Moment | string = moment()) {
  return moment(now).startOf('day');
}

function resolveDayOffset(
  dayOffset: number | undefined,
  legacyHourOffset: number | undefined,
  defaultValue: number
) {
  if (dayOffset !== undefined) {
    return dayOffset;
  }
  if (legacyHourOffset !== undefined) {
    return Math.round(legacyHourOffset / 24);
  }
  return defaultValue;
}

export function buildSavedQuery({
  id,
  name,
  query_code,
  startdate,
  enddate,
  event_type,
  now = moment(),
}: {
  id: string;
  name: string;
  query_code: string;
  startdate: string;
  enddate: string;
  event_type?: string;
  now?: Moment | string;
}): SavedQuery {
  const reference = referenceDay(now);

  return {
    id,
    name: name.trim(),
    query_code,
    start_day_offset: reference.diff(moment(startdate).startOf('day'), 'days'),
    end_day_offset: reference.diff(moment(enddate).startOf('day'), 'days'),
    event_type,
  };
}

export function resolveSavedQueryDates(savedQuery: SavedQuery, now: Moment | string = moment()) {
  const reference = referenceDay(now);
  const startOffset = resolveDayOffset(savedQuery.start_day_offset, savedQuery.start_offset, 0);
  const endOffset = resolveDayOffset(savedQuery.end_day_offset, savedQuery.end_offset, -1);

  return {
    startdate: moment(reference).subtract(startOffset, 'days').format('YYYY-MM-DD'),
    enddate: moment(reference).subtract(endOffset, 'days').format('YYYY-MM-DD'),
  };
}

export function getDefaultSavedQueryName(queryCode: string, now: Moment | string = moment()) {
  const firstLine = queryCode
    .split('\n')
    .map(line => line.trim())
    .find(Boolean);

  if (firstLine) {
    return firstLine.slice(0, 60);
  }

  return `Query ${moment(now).format('YYYY-MM-DD')}`;
}

export function buildSavedQueryId(name: string, existingIds: string[] = []) {
  const base =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'saved-query';

  let candidate = base;
  let suffix = 2;
  while (existingIds.includes(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function sortSavedQueries(savedQueries: SavedQuery[]) {
  return [...savedQueries].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
