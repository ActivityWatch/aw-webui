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

  it('shortens synced bucket names to "short @ remote-host" format', () => {
    // Previously rendered as "aw-watcher-window (synced from remote-host)"
    // — now consistent with local format: "window @ remote-host"
    expect(formatTimelineBucketLabelHtml('aw-watcher-window_host-synced-from-remote-host')).toBe(
      '<span class="timeline-label" title="aw-watcher-window_host-synced-from-remote-host">window @ remote-​host</span>'
    );
    expect(formatTimelineBucketLabelHtml('aw-watcher-afk_laptop-synced-from-desktop')).toBe(
      '<span class="timeline-label" title="aw-watcher-afk_laptop-synced-from-desktop">afk @ desktop</span>'
    );
  });

  it('disambiguates local buckets with hostname option', () => {
    expect(
      formatTimelineBucketLabelHtml('aw-watcher-afk_work-macbook', { hostname: 'work-macbook' })
    ).toBe(
      '<span class="timeline-label" title="aw-watcher-afk_work-macbook">afk @ work-​macbook</span>'
    );
  });

  it('preserves underscores in origin hostname for synced buckets', () => {
    // Regression for https://github.com/ActivityWatch/aw-webui/issues/967:
    // 'aw-watcher-android-synced-from-my_phone' was rendering as
    // 'android-synced-from-my' because the old underscore-split regex consumed
    // 'my_phone' as the host separator, leaving no '-synced-from-' to match.
    expect(formatTimelineBucketLabelHtml('aw-watcher-android-synced-from-my_phone')).toBe(
      '<span class="timeline-label" title="aw-watcher-android-synced-from-my_phone">android @ my_​phone</span>'
    );
  });

  it('escapes HTML in bucket IDs', () => {
    expect(formatTimelineBucketLabelHtml('bucket<script>')).toBe(
      '<span class="timeline-label" title="bucket&lt;script&gt;">bucket&lt;script&gt;</span>'
    );
  });
});
