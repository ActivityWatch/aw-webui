import _ from 'lodash';
import { canonicalEvents, querystr_to_array, BaseQueryParams } from '~/queries';
import { IEvent } from './interfaces';

interface TimelineBucket {
  id: string;
  type: string;
  hostname?: string;
}

/** Use the Activity view's canonical stream, not independently classified raw buckets.
 * Earlier visible sources win overlaps, just as in the multidevice Activity query.
 * AFK buckets remain available even when the client filter hides their raw rows.
 */
export function categoryTimelineQuery(
  visible: TimelineBucket[],
  all: TimelineBucket[],
  params: BaseQueryParams & { filter_afk: boolean; always_active_pattern?: string }
): string[] | null {
  const sources = visible.filter(
    b => b.type === 'currentwindow' || (b.type === 'app' && b.id.startsWith('aw-import-screentime'))
  );
  if (!sources.length) return null;
  const queries = sources.map((bucket, i) => {
    const common = { ...params, filter_categories: [], return_variable_suffix: `timeline_${i}` };
    if (
      bucket.id.startsWith('aw-watcher-android') ||
      bucket.id.startsWith('aw-import-screentime')
    ) {
      return canonicalEvents({
        ...common,
        bid_android: bucket.id,
        isIos: bucket.id.startsWith('aw-import-screentime'),
        keep_event_timestamps: true,
      });
    }
    const afk = all.find(b => b.type === 'afkstatus' && b.hostname === bucket.hostname);
    return canonicalEvents({
      ...common,
      bid_window: bucket.id,
      bid_afk: afk?.id || '',
      filter_afk: params.filter_afk && !!afk,
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
    queries.push(`events = filter_keyvals(events, "$category", ${JSON.stringify(selected)});`);
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
    if (previous && start <= previousEnd && _.isEqual(previous.data.$category, category)) {
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
