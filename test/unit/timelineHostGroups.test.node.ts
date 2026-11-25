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
    // Top-level rows name level 0, so a previously nested row cannot keep its
    // old indentation when the host rows disappear.
    expect(level['aw-stopwatch']).toBe(0);
  });

  it('returns top-level rows unchanged for a single host', () => {
    const groups = [g('aw-watcher-window_a'), g('aw-watcher-afk_a')];
    const out = nestGroupsByHost(groups, hostOf, label);
    expect(out.map(x => x.id)).toEqual(groups.map(x => x.id));
    expect(out.every(x => x.treeLevel === 0)).toBe(true);
  });

  it('clears a stale nested level when the host filter leaves one host', () => {
    // All hosts first: the buckets are children at level 1.
    const nested = nestGroupsByHost(
      [g('aw-watcher-window_a'), g('aw-watcher-window_b')],
      hostOf,
      label
    );
    const data = makeData();
    syncTimelineData(data, nested);
    expect(data.store.get('aw-watcher-window_a').treeLevel).toBe(1);
    // ItemSet writes the parent id into the real DataSet when nesting rows.
    data.store.get('aw-watcher-window_a').nestedInGroup = HOST_GROUP_PREFIX + 'a';

    // Switching the filter to one host drops the host rows. A level change
    // must recreate the row, clearing vis-timeline's parent metadata as well.
    const filtered = nestGroupsByHost([g('aw-watcher-window_a')], hostOf, label);
    syncTimelineData(data, filtered);
    expect(data.store.get('aw-watcher-window_a').treeLevel).toBe(0);
    expect(data.store.get('aw-watcher-window_a').nestedInGroup).toBeUndefined();
    expect(data.store.get(HOST_GROUP_PREFIX + 'b')).toBeUndefined();
  });

  it('keeps hostless buckets top-level and counts only real hosts', () => {
    const groups = [g('aw-stopwatch'), g('aw-watcher-window_a')];
    const flat = nestGroupsByHost(groups, hostOf, label);
    expect(flat.map(x => x.id)).toEqual(groups.map(x => x.id));
    expect(Object.fromEntries(flat.map(x => [x.id, x.treeLevel]))['aw-stopwatch']).toBe(0);
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
