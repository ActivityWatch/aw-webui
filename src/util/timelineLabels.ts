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
  return str.replace(/([/_-])/g, '$1\u200B');
}

export function formatTimelineBucketLabelHtml(bucketId: string): string {
  const escaped = escapeHtml(bucketId);
  const syncMatch = bucketId.match(/^([^_]+)_.*-synced-from-(.+)$/);

  if (syncMatch) {
    const baseLabel = addWrapOpportunities(escapeHtml(syncMatch[1]));
    const remoteLabel = addWrapOpportunities(escapeHtml(syncMatch[2]));
    return `<span class="timeline-label" title="${escaped}">${baseLabel} (synced from ${remoteLabel})</span>`;
  }

  return `<span class="timeline-label" title="${escaped}">${addWrapOpportunities(escaped)}</span>`;
}
