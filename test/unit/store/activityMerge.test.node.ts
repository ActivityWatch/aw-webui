import { mergeAppQueryResults, mergeEditorResults } from '~/stores/activity';

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
