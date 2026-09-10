// Cache policy for the active-duration history behind the period-usage chart.
//
// Two separate concerns live here: whether previously fetched periods may be
// reused at all (cache identity), and which periods still need to be fetched
// (freshness).

import { ActivityQuerySource } from '~/queries';

// Everything that changes what the active-duration query would return. If any
// of it differs, previously fetched periods describe a different question and
// must not be reused.
export interface ActiveHistoryContext {
  // Desktop and Android/iOS use different queries and bucket sets.
  platform: 'desktop' | 'android';
  host: string;
  useMultidevice: boolean;
  // Period boundaries themselves depend on this.
  startOfDay: string;
  // Semantic inputs to the active-period union.
  include_audible?: boolean;
  always_active_pattern?: string;
}

// Returns a stable identity for the given context and resolved source buckets.
// Bucket ids are sorted so that source discovery order cannot invalidate an
// otherwise-identical cache.
export function activeHistoryCacheKey(
  context: ActiveHistoryContext,
  sources: (ActivityQuerySource | string)[]
): string {
  const normalized_sources = sources
    .map(source => {
      if (typeof source === 'string') return { bid_afk: source };
      return source;
    })
    .map(source => [
      source.bid_afk || '',
      source.bid_window || '',
      [...(source.bid_browsers || [])].sort().join(','),
    ])
    .map(parts => parts.join('|'))
    .sort();

  return JSON.stringify({
    platform: context.platform,
    host: context.host || '',
    useMultidevice: !!context.useMultidevice,
    startOfDay: context.startOfDay || '',
    include_audible: !!context.include_audible,
    always_active_pattern: context.always_active_pattern || '',
    sources: normalized_sources,
  });
}

// Parses the "<start>/<end>" period strings the store works in.
function periodBounds(period_str: string): { start: number; end: number } {
  const [start, end] = period_str.split('/');
  return { start: new Date(start).getTime(), end: new Date(end).getTime() };
}

/**
 * Selects the periods that must actually be queried.
 *
 * A period is skipped when it is already cached, and cached includes a
 * completed empty result: nothing happened then, and that answer does not
 * change. Two kinds of period are never served from the cache:
 *
 *  - the period containing `now`, which is still open and whose duration keeps
 *    growing, so it is always refetched;
 *  - periods starting at or after `now`, which cannot have data yet. This is
 *    the existing desktop policy, now applied to Android/iOS as well so both
 *    platforms behave the same.
 */
export function selectPeriodsToQuery(
  period_strs: string[],
  cached: Record<string, unknown>,
  now: Date = new Date()
): string[] {
  const now_ms = now.getTime();

  return period_strs.filter(period_str => {
    const { start, end } = periodBounds(period_str);

    // Unparseable period: query it rather than silently dropping it.
    if (Number.isNaN(start) || Number.isNaN(end)) return true;

    // Nothing to measure yet.
    if (start >= now_ms) return false;

    // The open period is always refreshed so its duration can grow.
    if (now_ms < end) return true;

    return !Object.prototype.hasOwnProperty.call(cached, period_str);
  });
}
