import { DataSet } from 'vis-data';
import { Timeline } from 'vis-timeline';
import { nestGroupsByHost, HOST_GROUP_PREFIX } from '~/util/timelineHostGroups';
import { syncTimelineData } from '~/util/timelineIndex';

describe('host nesting with a real vis-timeline', () => {
  it('rebuilds flat labels and restores nesting when the host filter changes', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const groups = new DataSet<any>();
    const items = new DataSet<any>([
      { id: 'event', group: 'bucket_a', start: '2026-11-24T10:00:00Z', content: 'event' },
    ]);
    const timeline = new Timeline(container, items, groups, {
      autoResize: false,
      start: '2026-11-24T09:00:00Z',
      end: '2026-11-24T11:00:00Z',
    });
    const rows = hosts =>
      nestGroupsByHost(
        hosts.map(host => ({ id: `bucket_${host}`, content: host })),
        id => id.split('_')[1],
        host => host
      );
    const label = () =>
      Array.from(container.querySelectorAll('.vis-label')).find(el => el.textContent === 'a');
    try {
      syncTimelineData(groups, rows(['a', 'b']));
      timeline.redraw();
      expect(groups.get('bucket_a').nestedInGroup).toBe(HOST_GROUP_PREFIX + 'a');
      expect(container.querySelector('.vis-group-level-1')).not.toBeNull();

      syncTimelineData(groups, rows(['a']));
      timeline.redraw();
      expect(groups.get('bucket_a').nestedInGroup).toBeUndefined();
      expect(label().classList.contains('vis-group-level-0')).toBe(true);
      expect(label().classList.contains('vis-group-level-1')).toBe(false);
      expect(label().classList.contains('vis-nested-group')).toBe(false);
      expect(container.querySelector('.vis-group-level-unknown-but-gte1')).toBeNull();

      syncTimelineData(groups, rows(['a', 'b']));
      timeline.redraw();
      expect(groups.get('bucket_a').nestedInGroup).toBe(HOST_GROUP_PREFIX + 'a');
      const childLabel = container.querySelector('.vis-group-level-1');
      expect(childLabel).not.toBeNull();
      expect(childLabel.classList.contains('vis-group-level-0')).toBe(false);
      expect(container.querySelector('.vis-group-level-unknown-but-gte1')).toBeNull();
      // jsdom has no layout, so inspect the real ItemSet's group membership.
      expect((timeline as any).itemSet.groups.bucket_a.items.event.data.content).toBe('event');

      // Ordinary rebuilds must not recreate unchanged parents or discard the
      // collapse state that vis-timeline stores on them.
      groups.update({ id: HOST_GROUP_PREFIX + 'a', showNested: false });
      syncTimelineData(groups, rows(['a', 'b']));
      expect(groups.get(HOST_GROUP_PREFIX + 'a').showNested).toBe(false);
    } finally {
      timeline.destroy();
      container.remove();
    }
  });
});
