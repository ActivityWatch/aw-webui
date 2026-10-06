import { mergeAppQueryResults, mergeEditorResults, withDominantCategory } from '~/stores/activity';

const _sum = (cats: [string[], number][]) => cats.reduce((acc, [, d]) => acc + d, 0);

const ev = (data: Record<string, unknown>, duration: number) => ({
  timestamp: '2026-01-01T00:00:00Z',
  duration,
  data,
});

describe('mergeEditorResults', () => {
  test('sums durations per key across chunks', () => {
    const merged = mergeEditorResults([
      {
        files: [ev({ file: 'a.py', language: 'python' }, 10)],
        languages: [ev({ language: 'python' }, 10)],
        projects: [ev({ project: 'p' }, 10)],
        duration: 10,
      },
      {
        files: [
          ev({ file: 'a.py', language: 'python' }, 5),
          ev({ file: 'b.ts', language: 'ts' }, 20),
        ],
        languages: [ev({ language: 'python' }, 5), ev({ language: 'ts' }, 20)],
        projects: [ev({ project: 'p' }, 25)],
        duration: 25,
      },
    ]);
    expect(merged.duration).toBe(35);
    expect(merged.files.map(e => [e.data.file, e.duration])).toEqual([
      ['b.ts', 20],
      ['a.py', 15],
    ]);
    expect(merged.projects).toHaveLength(1);
    expect(merged.projects[0].duration).toBe(35);
  });
});

describe('mergeAppQueryResults', () => {
  test('returns a single chunk unchanged', () => {
    const r = { app_events: [], title_events: [], cat_events: [], duration: 1 };
    expect(mergeAppQueryResults([r], false)).toBe(r);
  });

  test('merges apps, titles and categories across chunks', () => {
    const chunk = (d: number) => ({
      app_events: [ev({ app: 'com.a' }, d)],
      title_events: [ev({ app: 'com.a', classname: 'com.a', title: 'A' }, d)],
      cat_events: [ev({ $category: ['Work'] }, d)],
      duration: d,
    });
    const merged = mergeAppQueryResults([chunk(1), chunk(2)], true);
    expect(merged.duration).toBe(3);
    expect(merged.app_events[0].duration).toBe(3);
    expect(merged.title_events[0].duration).toBe(3);
    expect(merged.cat_events[0].duration).toBe(3);
    expect(merged.active_events).toBe(merged.app_events);
  });
});

describe('withDominantCategory', () => {
  test('colors each app by its longest category, not by its name', () => {
    const apps = [ev({ app: 'Google Chrome' }, 60), ev({ app: 'Terminal' }, 30)];
    const appCats = [
      ev({ app: 'Google Chrome', $category: ['Work', 'Programming'] }, 40),
      ev({ app: 'Google Chrome', $category: ['Media', 'Video'] }, 15),
      ev({ app: 'Google Chrome', $category: ['Uncategorized'] }, 5),
      ev({ app: 'Terminal', $category: ['Uncategorized'] }, 30),
    ];
    const result = withDominantCategory(apps, appCats);
    expect(result.map(e => [e.data.app, e.data.$category, e.duration])).toEqual([
      ['Google Chrome', ['Work', 'Programming'], 60],
      ['Terminal', ['Uncategorized'], 30],
    ]);
    // Does not mutate the input events
    expect(apps[0].data).toEqual({ app: 'Google Chrome' });
  });

  test('leaves apps unchanged without app_cat_events', () => {
    const apps = [ev({ app: 'code' }, 10)];
    expect(withDominantCategory(apps, undefined)).toBe(apps);
    expect(withDominantCategory(apps, [])).toBe(apps);
    expect(withDominantCategory(apps, [ev({ app: 'other', $category: ['Work'] }, 1)])[0]).toBe(
      apps[0]
    );
  });

  test('sums category durations across merged chunks before picking', () => {
    const chunk = (cats: [string[], number][]) => ({
      app_events: [ev({ app: 'firefox' }, _sum(cats))],
      app_cat_events: cats.map(([cat, d]) => ev({ app: 'firefox', $category: cat }, d)),
      title_events: [],
      cat_events: [],
      duration: _sum(cats),
    });
    // Media is the longest single entry (20), Work only wins once summed (45)
    const merged = mergeAppQueryResults(
      [
        chunk([
          [['Work'], 15],
          [['Media'], 20],
        ]),
        chunk([[['Work'], 15]]),
        chunk([[['Work'], 15]]),
      ],
      false
    );
    const [firefox] = withDominantCategory(merged.app_events, merged.app_cat_events);
    expect(firefox.data.$category).toEqual(['Work']);
  });

  test('keeps ScreenTime apps that share a display name apart', () => {
    // After the ScreenTime remap both lists carry the bundle ID as classname
    const apps = [
      ev({ app: 'Notes', classname: 'com.apple.notes' }, 30),
      ev({ app: 'Notes', classname: 'com.example.notes' }, 20),
    ];
    const appCats = [
      ev({ app: 'Notes', classname: 'com.apple.notes', $category: ['Work'] }, 30),
      ev({ app: 'Notes', classname: 'com.example.notes', $category: ['Media'] }, 20),
    ];
    expect(withDominantCategory(apps, appCats).map(e => e.data.$category)).toEqual([
      ['Work'],
      ['Media'],
    ]);
  });
});
