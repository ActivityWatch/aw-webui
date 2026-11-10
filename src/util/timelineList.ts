import { getTitleAttr } from '~/util/color';
import { IEvent } from '~/util/interfaces';

export const TIMELINE_LIST_PAGE_SIZE = 100;
const DETAIL_MAX_LENGTH = 120;

// Anything `new Date()` accepts, including the moment objects the Timeline passes.
type RangeBound = Date | string | number | { valueOf(): number };

export interface TimelineListBucket {
  id: string;
  hostname?: string;
  type?: string;
  events?: IEvent[];
}

export interface TimelineListRow {
  key: string;
  bucketId: string;
  hostname: string;
  start: number;
  end: number;
  duration: number;
  label: string;
  detail: string;
  // The server truncates events to the queried range, so a row touching a range edge
  // may have started earlier / ended later than shown.
  clippedStart: boolean;
  clippedEnd: boolean;
}

// The event title shown next to the colour/grouping label, when it adds information.
function eventDetail(e: IEvent, label: string): string {
  const title = e.data?.title;
  if (typeof title === 'string' && title && title !== label) return title;
  const url = e.data?.url;
  if (typeof url === 'string' && url && url !== label) return url;
  if (label) return '';
  // No title for this bucket type: show the data fields instead of a blank cell.
  const summary = Object.entries(e.data || {})
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(', ');
  return summary.length > DETAIL_MAX_LENGTH
    ? summary.slice(0, DETAIL_MAX_LENGTH - 1) + '…'
    : summary;
}

/**
 * Flattens the Timeline's filtered buckets into one chronological, read-only list.
 *
 * Every event stays its own row with its source bucket and host: concurrent events
 * from different buckets are kept rather than merged into one canonical stream.
 * Events arrive clipped to the queried `range`, so rows touching its edges are flagged
 * rather than presented as exact. Equal start times are ordered by bucket id, then by
 * position in the bucket, so the order does not depend on bucket order.
 */
export function timelineListRows(
  buckets: TimelineListBucket[] | null | undefined,
  range?: [RangeBound, RangeBound] | null
): TimelineListRow[] {
  const rangeStart = range ? new Date(range[0] as Date).getTime() : NaN;
  const rangeEnd = range ? new Date(range[1] as Date).getTime() : NaN;
  const rows: (TimelineListRow & { index: number })[] = [];
  for (const bucket of buckets || []) {
    (bucket.events || []).forEach((e, index) => {
      const start = new Date(e.timestamp).getTime();
      let label = '';
      try {
        label = getTitleAttr(bucket, e) || '';
      } catch {
        // Malformed data for the bucket type; fall back to the raw title below.
      }
      const end = start + e.duration * 1000;
      rows.push({
        key: `${bucket.id}:${index}`,
        bucketId: bucket.id,
        hostname: bucket.hostname || '',
        start,
        end,
        duration: e.duration,
        label,
        detail: eventDetail(e, label),
        clippedStart: start <= rangeStart,
        clippedEnd: end >= rangeEnd,
        index,
      });
    });
  }
  rows.sort(
    (a, b) =>
      a.start - b.start ||
      (a.bucketId < b.bucketId ? -1 : a.bucketId > b.bucketId ? 1 : 0) ||
      a.index - b.index
  );
  return rows.map(({ index: _index, ...row }) => row);
}
