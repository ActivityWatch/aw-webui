import { formatTimelineBucketLabelHtml } from '~/util/timelineLabels';

describe('formatTimelineBucketLabelHtml', () => {
  test('adds wrap opportunities for long bucket names', () => {
    expect(formatTimelineBucketLabelHtml('aw-watcher-window_host')).toBe(
      '<span class="timeline-label" title="aw-watcher-window_host">aw-<wbr>watcher-<wbr>window_<wbr>host</span>'
    );
  });

  test('abbreviates synced bucket names and preserves wrap opportunities', () => {
    expect(formatTimelineBucketLabelHtml('aw-watcher-window_host-synced-from-remote-host')).toBe(
      '<span class="timeline-label" title="aw-watcher-window_host-synced-from-remote-host">aw-<wbr>watcher-<wbr>window (synced from remote-<wbr>host)</span>'
    );
  });

  test('adds wrap opportunities for slash-separated bucket names', () => {
    expect(formatTimelineBucketLabelHtml('aw-watcher-window/host/session')).toBe(
      '<span class="timeline-label" title="aw-watcher-window/host/session">aw-<wbr>watcher-<wbr>window/<wbr>host/<wbr>session</span>'
    );
  });

  test('escapes HTML before inserting wrap opportunities', () => {
    expect(formatTimelineBucketLabelHtml('bucket<script>')).toBe(
      '<span class="timeline-label" title="bucket&lt;script&gt;">bucket&lt;script&gt;</span>'
    );
  });
});
