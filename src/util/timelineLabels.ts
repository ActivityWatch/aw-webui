function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function addWrapOpportunities(str: string): string {
  // Insert zero-width space after word-breaking characters so the label
  // breaks at natural boundaries without HTML <wbr> tags (vis-timeline
  // does not support <wbr> in group label content).
  return str.replace(/([/_-])/g, '$1​');
}

// Strips the noisy aw-watcher- / aw- prefix and the trailing
// _<hostname> segment so a bucket id like
//   aw-watcher-window_erb-m2.localdomain
// reads as just "window" in the timeline's row label. The full id is
// still surfaced via the <title> tooltip on hover for unambiguity.
// Returns null when the input doesn't match the conventional shape, so
// callers can fall back to the original id.
export function shortenBucketLabel(bucketId: string): string | null {
  // Drop the host suffix first (everything from the first underscore on).
  // Some bucket ids have no host (e.g. "aw-stopwatch"), in which case we
  // keep the full id.
  const sepIdx = bucketId.indexOf('_');
  const head = sepIdx === -1 ? bucketId : bucketId.slice(0, sepIdx);

  // Drop the conventional prefix.
  let body = head;
  if (body.startsWith('aw-watcher-')) body = body.slice('aw-watcher-'.length);
  else if (body.startsWith('aw-')) body = body.slice('aw-'.length);

  if (!body || body === head) return null;
  return body;
}

export interface BucketLabelOptions {
  // When the timeline mixes buckets from multiple hosts (no host filter
  // applied), the short label "window" collides between hosts. Pass the
  // bucket's hostname to disambiguate as e.g. "window @ host".
  hostname?: string;
}

export function formatTimelineBucketLabelHtml(
  bucketId: string,
  options: BucketLabelOptions = {}
): string {
  const escaped = escapeHtml(bucketId);

  // Detect synced buckets by searching for the literal '-synced-from-' marker
  // rather than using an underscore-split regex. The old regex
  //   /^([^_]+)_.*-synced-from-(.+)$/
  // failed for bucket ids where the origin hostname contains underscores
  // (e.g. 'aw-watcher-android-synced-from-my_phone'), because [^_]+ stopped
  // at the underscore inside the hostname, leaving no room for '-synced-from-'
  // to match in the remaining string.
  const syncMarker = '-synced-from-';
  const syncIdx = bucketId.indexOf(syncMarker);
  if (syncIdx !== -1) {
    const basePart = bucketId.slice(0, syncIdx);
    const remotePart = bucketId.slice(syncIdx + syncMarker.length);
    // Strip optional '_<hostname>' suffix from the base part, which is present
    // when the source bucket follows the conventional aw-watcher-type_host format.
    const underscoreIdx = basePart.indexOf('_');
    const baseDisplay = underscoreIdx !== -1 ? basePart.slice(0, underscoreIdx) : basePart;
    const baseLabel = addWrapOpportunities(escapeHtml(baseDisplay));
    const remoteLabel = addWrapOpportunities(escapeHtml(remotePart));
    return `<span class="timeline-label" title="${escaped}">${baseLabel} (synced from ${remoteLabel})</span>`;
  }

  const short = shortenBucketLabel(bucketId);
  if (short) {
    let display = short;
    if (options.hostname) {
      display = `${short} @ ${options.hostname}`;
    }
    const shortLabel = addWrapOpportunities(escapeHtml(display));
    return `<span class="timeline-label" title="${escaped}">${shortLabel}</span>`;
  }

  // Fallback: keep the full id with wrap opportunities.
  return `<span class="timeline-label" title="${escaped}">${addWrapOpportunities(escaped)}</span>`;
}
