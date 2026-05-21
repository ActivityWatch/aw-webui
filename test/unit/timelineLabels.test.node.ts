import { formatTimelineBucketLabelHtml } from '~/util/timelineLabels';

describe('formatTimelineBucketLabelHtml', () => {
  it('should add word-break opportunities after separators', () => {
    expect(formatTimelineBucketLabelHtml('aw-watcher-window_host')).toBe(
      '<span class="timeline-label" title="aw-watcher-window_host">aw-\u200Bwatcher-\u200Bwindow_\u200Bhost</span>'
    );
  });

  it('should abbreviate synced bucket names', () => {
    expect(formatTimelineBucketLabelHtml('aw-watcher-window_host-synced-from-remote-host')).toBe(
      '<span class="timeline-label" title="aw-watcher-window_host-synced-from-remote-host">aw-\u200Bwatcher-\u200Bwindow (synced from remote-\u200Bhost)</span>'
    );
  });

  it('should handle slashes', () => {
    expect(formatTimelineBucketLabelHtml('aw-watcher-window/host/session')).toBe(
      '<span class="timeline-label" title="aw-watcher-window/host/session">aw-\u200Bwatcher-\u200Bwindow/\u200Bhost/\u200Bsession</span>'
    );
  });

  it('should escape HTML in bucket IDs', () => {
    expect(formatTimelineBucketLabelHtml('bucket<script>')).toBe(
      '<span class="timeline-label" title="bucket&lt;script&gt;">bucket&lt;script&gt;</span>'
    );
  });
});
