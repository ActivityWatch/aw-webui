import { getTitleAttr } from '~/util/color';
import { IEvent } from '~/util/interfaces';

export const TIMELINE_LIST_PAGE_SIZE = 100;

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
}

// The event title shown next to the colour/grouping label, when it adds information.
function eventDetail(e: IEvent, label: string): string {
  const title = e.data?.title;
  if (typeof title === 'string' && title && title !== label) return title;
  const url = e.data?.url;
  if (typeof url === 'string' && url && url !== label) return url;
  return '';
}

/**
 * Flattens the Timeline's filtered buckets into one chronological, read-only list.
 *
 * Every event stays its own row with its source bucket and host: concurrent events
 * from different buckets are kept rather than merged into one canonical stream, and
 * events crossing the queried interval keep their true start and end. Equal start
 * times are ordered by bucket id, then by position in the bucket, so the order does
 * not depend on bucket order.
 */
export function timelineListRows(
  buckets: TimelineListBucket[] | null | undefined
): TimelineListRow[] {
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
      rows.push({
        key: `${bucket.id}:${index}`,
        bucketId: bucket.id,
        hostname: bucket.hostname || '',
        start,
        end: start + e.duration * 1000,
        duration: e.duration,
        label,
        detail: eventDetail(e, label),
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
