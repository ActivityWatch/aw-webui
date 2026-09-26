import { IBucket } from '~/util/interfaces';

type GetEvents = (
  bucketId: string,
  params: { end?: Date; limit: number }
) => Promise<{ timestamp: string | Date }[]>;

const DAY_MS = 24 * 60 * 60 * 1000;
// Lower bound for the search; ActivityWatch has no data from before this.
const SEARCH_FLOOR = new Date('2000-01-01T00:00:00Z');

/**
 * Timestamp of the earliest event in a bucket, with ~1 day precision.
 *
 * aw-server-rust reports it directly as `metadata.start`. aw-server (Python)
 * has no such field, so we bisect with `GET /events?end=<t>&limit=1`, which
 * returns the latest event before `t` from an indexed query. That is ~15 small
 * requests per bucket instead of reading every event.
 */
export async function earliestEventInBucket(
  bucket: IBucket,
  getEvents: GetEvents
): Promise<Date | null> {
  if (bucket.metadata && bucket.metadata.start) {
    return new Date(bucket.metadata.start);
  }

  const latest = await getEvents(bucket.id, { limit: 1 });
  if (latest.length === 0) return null;

  // Invariant: an event exists at or before `hi`, none before `lo`.
  let hi = new Date(latest[0].timestamp).getTime();
  let lo = SEARCH_FLOOR.getTime();
  for (let i = 0; i < 40 && hi - lo > DAY_MS; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const events = await getEvents(bucket.id, { end: new Date(mid), limit: 1 });
    if (events.length === 0) {
      lo = mid;
    } else {
      // The returned event may overlap `mid` rather than start before it.
      hi = Math.min(mid, new Date(events[0].timestamp).getTime());
    }
  }
  return new Date(hi);
}

/** Earliest event across several buckets, or null if all are empty. */
export async function earliestEventInBuckets(
  buckets: IBucket[],
  getEvents: GetEvents
): Promise<Date | null> {
  const starts = await Promise.all(buckets.map(b => earliestEventInBucket(b, getEvents)));
  const valid = starts.filter((d): d is Date => d !== null);
  if (valid.length === 0) return null;
  return new Date(Math.min(...valid.map(d => d.getTime())));
}
