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

test('matches events using selected fields only', () => {
  const fieldScopedClasses: Category[] = [
    { name: ['Browser'], rule: { type: 'regex', regex: 'Firefox', select_keys: ['app'] } },
    { name: ['Docs'], rule: { type: 'regex', regex: 'Firefox', select_keys: ['title'] } },
  ];
  let events: IEvent[] = [
    {
      timestamp: new Date().toISOString(),
      duration: 0,
      data: { app: 'Firefox', title: 'Session notes' },
    },
    {
      timestamp: new Date().toISOString(),
      duration: 0,
      data: { app: 'Ghostty', title: 'Firefox docs' },
    },
    {
      timestamp: new Date().toISOString(),
      duration: 0,
      data: { app: 'Ghostty', title: 'Session notes' },
    },
  ];

  events = classes.classifyEvents(events, fieldScopedClasses);

  expect(events[0].data.$category).toEqual(fieldScopedClasses[0].name);
  expect(events[1].data.$category).toEqual(fieldScopedClasses[1].name);
  expect(events[2].data.$category).toEqual(['Uncategorized']);
});

test('cleanCategory drops empty select_keys but preserves valid ones', () => {
  const emptySelectKeys = classes.cleanCategory({
    name: ['Test'],
    rule: { type: 'regex', regex: 'Firefox', select_keys: [] },
  });
  const validSelectKeys = classes.cleanCategory({
    name: ['Test'],
    rule: { type: 'regex', regex: 'Firefox', select_keys: ['title'] },
  });

  expect(emptySelectKeys.rule.select_keys).toBeUndefined();
  expect(validSelectKeys.rule.select_keys).toEqual(['title']);
});
