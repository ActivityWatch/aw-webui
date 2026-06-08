import { formatTimelineBucketLabelHtml, shortenBucketLabel } from '~/util/timelineLabels';

describe('shortenBucketLabel', () => {
  it('strips the aw-watcher- prefix and the host suffix', () => {
    expect(shortenBucketLabel('aw-watcher-window_erb-m2.localdomain')).toBe('window');
    expect(shortenBucketLabel('aw-watcher-afk_erb-m2.localdomain')).toBe('afk');
  });

  it('keeps the browser sub-type', () => {
    expect(shortenBucketLabel('aw-watcher-web-firefox_host')).toBe('web-firefox');
  });

  it('returns null when no aw-watcher-/aw- prefix is present', () => {
    expect(shortenBucketLabel('custom-bucket')).toBeNull();
  });

  it('strips aw- prefix even for bucket ids without a host suffix', () => {
    expect(shortenBucketLabel('aw-stopwatch')).toBe('stopwatch');
  });
});

describe('formatTimelineBucketLabelHtml', () => {
  it('shortens conventional bucket ids in the label and preserves the full id in the tooltip', () => {
    expect(formatTimelineBucketLabelHtml('aw-watcher-window_erb-m2.localdomain')).toBe(
      '<span class="timeline-label" title="aw-watcher-window_erb-m2.localdomain">window</span>'
    );
  });

  it('shortens but keeps wrap opportunities for multi-part subtypes', () => {
    expect(formatTimelineBucketLabelHtml('aw-watcher-web-firefox_host')).toBe(
      '<span class="timeline-label" title="aw-watcher-web-firefox_host">web-​firefox</span>'
    );
  });

  it('falls back to the full id when no convention matches', () => {
    expect(formatTimelineBucketLabelHtml('custom-bucket')).toBe(
      '<span class="timeline-label" title="custom-bucket">custom-​bucket</span>'
    );
  });

  it('abbreviates synced bucket names', () => {
    expect(formatTimelineBucketLabelHtml('aw-watcher-window_host-synced-from-remote-host')).toBe(
      '<span class="timeline-label" title="aw-watcher-window_host-synced-from-remote-host">aw-​watcher-​window (synced from remote-​host)</span>'
    );
  });

  it('escapes HTML in bucket IDs', () => {
    expect(formatTimelineBucketLabelHtml('bucket<script>')).toBe(
      '<span class="timeline-label" title="bucket&lt;script&gt;">bucket&lt;script&gt;</span>'
    );
  });
});
