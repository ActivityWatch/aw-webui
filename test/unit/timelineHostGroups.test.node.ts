import { nestGroupsByHost, HOST_GROUP_PREFIX } from '~/util/timelineHostGroups';
import { syncTimelineData } from '~/util/timelineIndex';

const hosts: Record<string, string | undefined> = {
  'aw-watcher-window_a': 'a',
  'aw-watcher-afk_a': 'a',
  'aw-watcher-window_b': 'b',
  'aw-stopwatch': undefined,
};
const g = (id: string) => ({ id, content: id });
const hostOf = (id: string) => hosts[id];
const label = (h: string) => `host ${h}`;

describe('nestGroupsByHost', () => {
  it('nests buckets under one parent per host when two hosts are present', () => {
    const out = nestGroupsByHost(
      [g('aw-watcher-window_a'), g('aw-watcher-window_b'), g('aw-watcher-afk_a')],
      hostOf,
      label
    );
    expect(out.map(x => x.id)).toEqual([
      HOST_GROUP_PREFIX + 'a',
      'aw-watcher-window_a',
      'aw-watcher-afk_a',
      HOST_GROUP_PREFIX + 'b',
      'aw-watcher-window_b',
    ]);
    expect(out[0].nestedGroups).toEqual(['aw-watcher-window_a', 'aw-watcher-afk_a']);
    expect(out[0].content).toBe('host a');
  });

  it('gives nested bucket rows an explicit tree level', () => {
    const out = nestGroupsByHost(
      [g('aw-watcher-window_a'), g('aw-stopwatch'), g('aw-watcher-window_b')],
      hostOf,
      label
    );
    const level = Object.fromEntries(out.map(x => [x.id, x.treeLevel]));
    // A missing level on a nested row makes vis-timeline draw it with a red border.
    expect(level['aw-watcher-window_a']).toBe(1);
    expect(level['aw-watcher-window_b']).toBe(1);
    expect(level[HOST_GROUP_PREFIX + 'a']).toBeUndefined();
    expect(level['aw-stopwatch']).toBeUndefined();
  });

  it('returns the same array for a single host', () => {
    const groups = [g('aw-watcher-window_a'), g('aw-watcher-afk_a')];
    expect(nestGroupsByHost(groups, hostOf, label)).toBe(groups);
  });

  it('keeps hostless buckets top-level and counts only real hosts', () => {
    const groups = [g('aw-stopwatch'), g('aw-watcher-window_a')];
    expect(nestGroupsByHost(groups, hostOf, label)).toBe(groups);
    const out = nestGroupsByHost([...groups, g('aw-watcher-window_b')], hostOf, label);
    expect(out.map(x => x.id)).toEqual([
      'aw-stopwatch',
      HOST_GROUP_PREFIX + 'a',
      'aw-watcher-window_a',
      HOST_GROUP_PREFIX + 'b',
      'aw-watcher-window_b',
    ]);
  });
});

describe('syncTimelineData with nestedGroups', () => {
  const makeData = () => {
    const store = new Map<string, any>();
    return {
      store,
      updates: 0,
      getIds: () => [...store.keys()],
      get: (id: string) => store.get(id),
      remove: (ids: string[]) => ids.forEach(id => store.delete(id)),
      update(items: any[]) {
        this.updates++;
        items.forEach(i => store.set(i.id, { ...store.get(i.id), ...i }));
      },
    };
  };

  it('does not re-update an unchanged parent and keeps vis-written showNested', () => {
    const data = makeData();
    const parent = () => ({ id: 'p', content: 'p', nestedGroups: ['c'] });
    syncTimelineData(data, [parent()]);
    data.store.get('p').showNested = false; // what vis-timeline does on collapse
    syncTimelineData(data, [parent()]);
    expect(data.updates).toBe(1);
    expect(data.store.get('p').showNested).toBe(false);
  });
});
