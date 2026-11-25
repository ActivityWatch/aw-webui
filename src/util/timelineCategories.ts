import _ from 'lodash';
import {
  canonicalEvents,
  escape_doublequote,
  jsonForQuery,
  querystr_to_array,
  BaseQueryParams,
} from '~/queries';
import { IEvent } from './interfaces';

interface TimelineBucket {
  id: string;
  type: string;
  hostname?: string;
}

// `canonicalEvents` writes bucket ids verbatim, so callers escape them first.
// A value ending in a backslash cannot be written in aw-query at all; skip that
// source with a warning rather than emit an unparsable query that fails the
// whole categorized timeline.
function escapeTimelineBucketId(id: string): string | null {
  try {
    return escape_doublequote(id);
  } catch (e) {
    console.warn(`Skipping timeline source: ${(e as Error).message}`);
    return null;
  }
}

/** Use the Activity view's canonical stream, not independently classified raw buckets.
 * Earlier visible sources win overlaps, just as in the multidevice Activity query.
 * Like Activity's default, desktop sources are always AFK-filtered when the host has an
 * AFK bucket; the Timeline AFK switch only affects raw rows. AFK buckets remain available
 * even when the client filter hides their raw rows.
 */
export function categoryTimelineQuery(
  visible: TimelineBucket[],
  all: TimelineBucket[],
  params: BaseQueryParams & { always_active_pattern?: string }
): string[] | null {
  const sources = visible
    .filter(
      b =>
        b.type === 'currentwindow' || (b.type === 'app' && b.id.startsWith('aw-import-screentime'))
    )
    .flatMap(bucket => {
      const id = escapeTimelineBucketId(bucket.id);
      return id === null ? [] : [{ bucket, id }];
    });
  if (!sources.length) return null;
  const queries = sources.map(({ bucket, id }, i) => {
    const common = { ...params, filter_categories: [], return_variable_suffix: `timeline_${i}` };
    if (
      bucket.id.startsWith('aw-watcher-android') ||
      bucket.id.startsWith('aw-import-screentime')
    ) {
      return canonicalEvents({
        ...common,
        bid_android: id,
        isIos: bucket.id.startsWith('aw-import-screentime'),
        keep_event_timestamps: true,
      });
    }
    const afk = all.find(b => b.type === 'afkstatus' && b.hostname === bucket.hostname);
    const afk_id = afk ? escapeTimelineBucketId(afk.id) : null;
    return canonicalEvents({
      ...common,
      bid_window: id,
      bid_afk: afk_id ?? '',
      filter_afk: !!afk_id,
    });
  });
  queries.push('events = [];');
  sources.forEach((_bucket, i) => {
    queries.push(`events = union_no_overlap(events, events_timeline_${i});`);
  });
  // Filter after resolving overlap so a hidden category cannot reveal a lower-priority device.
  if (params.filter_categories?.length) {
    const selected = _.uniqWith(
      [
        ...params.filter_categories,
        ...params.categories
          .map(([name]) => name)
          .filter(name =>
            params.filter_categories.some(parent => _.isEqual(name.slice(0, parent.length), parent))
          ),
      ],
      _.isEqual
    );
    // Un-double backslashes as canonicalEvents does for categorize, so names match.
    const selected_str = jsonForQuery(selected);
    queries.push(`events = filter_keyvals(events, "$category", ${selected_str});`);
  }
  queries.push('RETURN = sort_by_timestamp(events);');
  return querystr_to_array(queries.join('\n'));
}

/** Merge touching/overlapping identical categories without filling AFK or no-data gaps.
 * Drop source IDs and payload: derived intervals must never open the raw event editor.
 */
export function mergeCategoryIntervals(events: IEvent[]): IEvent[] {
  const merged: IEvent[] = [];
  const sorted = [...events].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
  for (const event of sorted) {
    if (event.duration <= 0) continue;
    const category = event.data.$category?.length ? event.data.$category : ['Uncategorized'];
    const previous = merged[merged.length - 1];
    const start = +new Date(event.timestamp);
    const end = start + event.duration * 1000;
    const previousStart = previous && +new Date(previous.timestamp);
    const previousEnd = previous && previousStart + previous.duration * 1000;
    // < 1 ms gap counts as touching: Date truncates microsecond timestamps (as indexTimelineEvents).
    if (previous && start - previousEnd < 1 && _.isEqual(previous.data.$category, category)) {
      previous.duration = (Math.max(previousEnd, end) - previousStart) / 1000;
    } else {
      merged.push({
        timestamp: event.timestamp,
        duration: event.duration,
        data: { $category: [...category] },
      });
    }
  }
  return merged;
}
