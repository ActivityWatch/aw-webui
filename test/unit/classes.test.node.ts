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

test('select_keys restricts regex matching to named fields', () => {
  const cats: Category[] = [
    { name: ['AppOnly'], rule: { type: 'regex', regex: 'Firefox', select_keys: ['app'] } },
  ];
  const titleHit = classes.matchEventData({ app: 'Chrome', title: 'Firefox docs' }, cats);
  const appHit = classes.matchEventData({ app: 'Firefox', title: 'Chrome docs' }, cats);
  expect(titleHit).toBeNull();
  expect(appHit?.name).toEqual(['AppOnly']);
});

test('absent select_keys still matches any string field', () => {
  const cats: Category[] = [{ name: ['Any'], rule: { type: 'regex', regex: 'Firefox' } }];
  expect(classes.matchEventData({ app: 'Chrome', title: 'Firefox' }, cats)?.name).toEqual(['Any']);
  expect(classes.matchEventData({ url: 'https://Firefox.com' }, cats)?.name).toEqual(['Any']);
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
