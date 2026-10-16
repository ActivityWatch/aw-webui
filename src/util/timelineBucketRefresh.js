import { useBucketsStore } from '~/stores/buckets';

// Re-read the edited bucket so server-adjusted timestamps and durations are reflected.
// Other buckets can keep their already loaded events.
export async function reloadEditedBucket(
  allBuckets,
  displayedBuckets,
  bucketId,
  range,
  filterBuckets
) {
  const refreshed = await useBucketsStore().getBucketWithEvents({
    id: bucketId,
    start: range[0].format(),
    end: range[1].format(),
  });
  const [visible] = await filterBuckets([refreshed]);
  const nextAllBuckets = Object.freeze(
    allBuckets.map(bucket => (bucket.id === bucketId ? refreshed : bucket))
  );
  const displayed = new Map(displayedBuckets.map(bucket => [bucket.id, bucket]));
  displayed.delete(bucketId);
  if (visible) displayed.set(bucketId, visible);
  return {
    allBuckets: nextAllBuckets,
    displayedBuckets: nextAllBuckets.map(bucket => displayed.get(bucket.id)).filter(Boolean),
  };
}
