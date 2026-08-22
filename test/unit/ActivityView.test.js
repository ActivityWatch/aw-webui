import fs from 'fs';
import path from 'path';
import ActivityView from '~/views/activity/ActivityView.vue';

describe('ActivityView isVisLarge', () => {
  test('treats wide visualizations as full-width cards', () => {
    expect(ActivityView.methods.isVisLarge({ type: 'sunburst_clock' })).toBe(true);
    expect(ActivityView.methods.isVisLarge({ type: 'vis_timeline' })).toBe(true);
    expect(ActivityView.methods.isVisLarge({ type: 'timeline_barchart' })).toBe(false);
    expect(ActivityView.methods.isVisLarge({ type: 'top_apps' })).toBe(false);
  });
});

// Visualizations keep local state (the Top Bucket Data picker keeps its bucket,
// field and fetched events in `data`). The dashboard views all render the same
// list at the same positions, so a key of just the index lets Vue reuse the
// instance from the previous view and the stale state comes along with it.
// See https://github.com/ActivityWatch/aw-webui/issues/935
describe('ActivityView visualization keys', () => {
  test('keys visualizations by view id, not position alone', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../../src/views/activity/ActivityView.vue'),
      'utf8'
    );
    const key = source.match(/v-for="el, index in elements",\s*:key="([^"]+)"/);
    expect(key).not.toBeNull();
    expect(key[1]).toContain('view.id');
  });
});
