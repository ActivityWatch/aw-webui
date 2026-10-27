import * as classes from '~/util/classes';
import { IEvent } from '~/util/interfaces';
import { Category } from '~/util/classes';

const testClasses: Category[] = [
  { name: ['Test', 'Subtest'], rule: { type: 'regex', regex: 'subtest' } },
  { name: ['Test', 'Subtest', 'Subsubtest'], rule: { type: 'regex', regex: 'subsubtest' } },
];

test('correctly builds hierarchy', () => {
  const result = classes.build_category_hierarchy(testClasses);
  expect(result).toHaveLength(1);
  const cat_root = result[0];
  expect(cat_root.subname).toEqual('Test');
  expect(cat_root.children).toHaveLength(1);
  expect(result[0].children[0].children).toHaveLength(1);
});

test('correctly flatten hierarchy', () => {
  const result = classes.flatten_category_hierarchy(classes.build_category_hierarchy(testClasses));
  expect(result).toHaveLength(3);
});

test('matches string to category', () => {
  const cat = classes.matchString('subsubtest', testClasses);
  expect(cat).toEqual(testClasses[1]);
});

test('explicit priority can override category depth when matching strings', () => {
  const cats: Category[] = [
    { name: ['Shallow'], rule: { type: 'regex', regex: 'vim', priority: 25 } },
    { name: ['Group', 'Deep'], rule: { type: 'regex', regex: 'vim' } },
  ];

  expect(classes.matchString('vim', cats)?.name).toEqual(['Shallow']);
});

test('weight is accepted as a category priority alias', () => {
  const cats: Category[] = [
    { name: ['Shallow'], rule: { type: 'regex', regex: 'vim', weight: 25 } },
    { name: ['Group', 'Deep'], rule: { type: 'regex', regex: 'vim' } },
  ];

  expect(classes.matchString('vim', cats)?.name).toEqual(['Shallow']);
});

test('matches events to category', () => {
  let events: IEvent[] = [
    { timestamp: new Date().toISOString(), duration: 0, data: { title: 'subsubtest' } },
    { timestamp: new Date().toISOString(), duration: 0, data: { title: 'subtest' } },
    { timestamp: new Date().toISOString(), duration: 0, data: { title: 'no matching' } },
  ];
  events = classes.classifyEvents(events, testClasses);
  expect(events[0].data.$category).toEqual(testClasses[1].name);
  expect(events[1].data.$category).toEqual(testClasses[0].name);
  expect(events[2].data.$category).toEqual(['Uncategorized']);
});

test('explicit priority can override category depth when classifying events', () => {
  const cats: Category[] = [
    { name: ['Shallow'], rule: { type: 'regex', regex: 'vim', priority: 25 } },
    { name: ['Group', 'Deep'], rule: { type: 'regex', regex: 'vim' } },
  ];
  const events: IEvent[] = [
    { timestamp: new Date().toISOString(), duration: 0, data: { title: 'vim' } },
  ];

  expect(classes.classifyEvents(events, cats)[0].data.$category).toEqual(['Shallow']);
});

test('select_keys restricts regex matching to named fields', () => {
  const cats: Category[] = [
    { name: ['AppOnly'], rule: { type: 'regex', regex: 'Firefox', select_keys: ['app'] } },
  ];
  const titleEvent: IEvent = {
    timestamp: new Date().toISOString(),
    duration: 0,
    data: { app: 'Chrome', title: 'Firefox docs' },
  };
  const appEvent: IEvent = {
    timestamp: new Date().toISOString(),
    duration: 0,
    data: { app: 'Firefox', title: 'Chrome docs' },
  };
  const titleHit = classes.matchString('Chrome\nFirefox docs', cats, titleEvent);
  const appHit = classes.matchString('Firefox\nChrome docs', cats, appEvent);
  expect(titleHit).toBeNull();
  expect(appHit?.name).toEqual(['AppOnly']);
});

test('absent select_keys preserves legacy categorization-string matching', () => {
  const cats: Category[] = [{ name: ['Any'], rule: { type: 'regex', regex: 'Firefox' } }];
  const event: IEvent = {
    timestamp: new Date().toISOString(),
    duration: 0,
    data: { app: 'Chrome', title: 'Docs', url: 'https://Firefox.com' },
  };
  expect(classes.matchString('Chrome\nDocs', cats, event)).toBeNull();
  expect(classes.matchString('Chrome\nFirefox docs', cats, event)?.name).toEqual(['Any']);
});

test('absent select_keys preserves cross-field regex matching', () => {
  const cats: Category[] = [
    { name: ['CrossField'], rule: { type: 'regex', regex: 'Chrome\\nDocs' } },
  ];
  const event: IEvent = {
    timestamp: new Date().toISOString(),
    duration: 0,
    data: { app: 'Chrome', title: 'Docs' },
  };
  expect(classes.matchString('Chrome\nDocs', cats, event)?.name).toEqual(['CrossField']);
});

test('cleanCategory drops empty select_keys and keeps a real list', () => {
  const empty = classes.cleanCategory({
    name: ['X'],
    rule: { type: 'regex', regex: 'a', select_keys: [] },
  });
  expect(empty.rule.select_keys).toBeUndefined();

  const kept = classes.cleanCategory({
    name: ['Y'],
    rule: { type: 'regex', regex: 'a', select_keys: ['title', 'title', ''] },
  });
  expect(kept.rule.select_keys).toEqual(['title']);
});

test('normalizeSelectKeys rejects empty lists', () => {
  expect(classes.normalizeSelectKeys([])).toBeUndefined();
  expect(classes.normalizeSelectKeys(null)).toBeUndefined();
  expect(classes.normalizeSelectKeys(['app', 'title'])).toEqual(['app', 'title']);
});

// #382: a blank regex must not match everything client-side, matching how
// aw-core's server-side categorize() treats it.
test('blank regex category never matches, children still do', () => {
  const cats: Category[] = [
    { name: ['Work'], rule: { type: 'regex', regex: '' } },
    { name: ['Work', 'Programming'], rule: { type: 'regex', regex: 'vim' } },
  ];
  expect(classes.matchString('firefox', cats)).toBeNull();
  expect(classes.matchString('vim', cats)?.name).toEqual(['Work', 'Programming']);

  const events = classes.classifyEvents(
    [
      { timestamp: '', duration: 1, data: { app: 'firefox', title: 'x' } },
      { timestamp: '', duration: 1, data: { app: 'vim', title: 'x' } },
    ] as IEvent[],
    cats
  );
  expect(events.map(e => e.data.$category)).toEqual([['Uncategorized'], ['Work', 'Programming']]);
});

// The ambiguous 'kate' alternative must match a whole app/title field,
// not a substring of an unrelated title ('Skateboarding tips').
test.each<[string, string, string[] | null]>([
  ['Firefox', 'Skateboarding tips', null],
  ['Firefox', 'Dinner with kate', null],
  ['kate', 'notes.txt', ['Work', 'Programming']],
  ['vim', 'main.c', ['Work', 'Programming']],
  ['Firefox', 'GitHub - owner/repo', ['Work', 'Programming']],
])('default Programming rule for app=%s title=%s', (app, title, expected) => {
  const event: IEvent = { timestamp: '', duration: 1, data: { app, title } };
  const cat = classes.matchString(`${app}\n${title}`, classes.defaultCategories, event);
  expect(cat?.name ?? null).toEqual(expected);

  const [classified] = classes.classifyEvents([event], classes.defaultCategories);
  expect(classified.data.$category).toEqual(expected ?? ['Uncategorized']);
});

test('reuses regex objects while respecting in-place rule edits', () => {
  const cats: Category[] = [{ name: ['Work'], rule: { type: 'regex', regex: '^vim$' } }];
  const construct = jest.spyOn(global, 'RegExp');
  try {
    expect(classes.matchString('vim', cats)).toBe(cats[0]);
    expect(classes.matchString('other', cats)).toBeNull();
    expect(construct).toHaveBeenCalledTimes(1);
    cats[0].rule.ignore_case = true;
    expect(classes.matchString('VIM', cats)).toBe(cats[0]);
    cats[0].rule.regex = '^code$';
    expect(classes.matchString('vim', cats)).toBeNull();
    expect(classes.matchString('CODE', cats)).toBe(cats[0]);
    expect(construct).toHaveBeenCalledTimes(3);
  } finally {
    construct.mockRestore();
  }
});

// #495: common apps added to the built-in default categories.
describe('default category carry for common apps (#495)', () => {
  test.each([
    ['Google Sheets', ['Work']],
    ['TextEdit', ['Work']],
    ['Pages', ['Work']],
    ['Obsidian', ['Work']],
    ['iTerm', ['Work', 'Programming']],
    ['Visual Studio Code', ['Work', 'Programming']],
    ['LinkedIn', ['Media', 'Social Media']],
    ['Hacker News', ['Media', 'Social Media']],
    ['Amazon Music', ['Media', 'Music']],
    ['Texts', ['Comms', 'IM']],
    ['Superhuman', ['Comms', 'Email']],
  ])('%s is categorized by defaults', (str, expected) => {
    expect(classes.matchString(str, classes.defaultCategories)?.name).toEqual(expected);
  });

  test.each([
    ['Google Docs', ['Work']],
    ['GitHub', ['Work', 'Programming']],
    ['Slack', ['Comms', 'IM']],
    ['Gmail', ['Comms', 'Email']],
    ['Spotify', ['Media', 'Music']],
    ['reddit', ['Media', 'Social Media']],
    ['YouTube', ['Media', 'Video']],
    ['Minecraft', ['Media', 'Games']],
    ['unknown app', null],
  ])('existing control %s keeps its category', (str, expected) => {
    expect(classes.matchString(str, classes.defaultCategories)?.name ?? null).toEqual(expected);
  });

  test.each([
    ['Pages', ['Work']],
    ['Texts', ['Comms', 'IM']],
  ])('matches the complete %s app line beside a window title', (app, expected) => {
    expect(classes.matchString(`${app}\nUntitled`, classes.defaultCategories)?.name).toEqual(
      expected
    );
  });

  test.each(['Yellow Pages', 'Sacred Texts', 'Pages of history', 'Texts about history'])(
    'does not categorize the unrelated browser title %s as an app',
    title => {
      expect(classes.matchString(`Firefox\n${title}`, classes.defaultCategories)).toBeNull();
      const event: IEvent = {
        timestamp: new Date().toISOString(),
        duration: 1,
        data: { app: 'Firefox', title },
      };
      expect(classes.classifyEvents([event], classes.defaultCategories)[0].data.$category).toEqual([
        'Uncategorized',
      ]);
    }
  );

  test('saved custom rules still win and matching does not mutate them', () => {
    const custom: Category[] = [
      { name: ['Custom', 'Notes'], rule: { type: 'regex', regex: 'Obsidian', priority: 99 } },
    ];
    const customBefore = JSON.stringify(custom);
    const defaultsBefore = JSON.stringify(classes.defaultCategories);

    expect(
      classes.matchString('Obsidian', [...classes.defaultCategories, ...custom])?.name
    ).toEqual(['Custom', 'Notes']);
    expect(classes.matchString('Google Docs', classes.defaultCategories)?.name).toEqual(['Work']);

    expect(JSON.stringify(custom)).toBe(customBefore);
    expect(JSON.stringify(classes.defaultCategories)).toBe(defaultsBefore);
  });
});
