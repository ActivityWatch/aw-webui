import { buildBarchartDataset } from '~/util/datasets';
const event = (path, duration) => ({ timestamp: '', duration, data: { $category: path } });

test('aggregates duplicate categories and preserves missing versus zero values and period order', () => {
  const data = {
    first: { cat_events: [event(['Work'], 1800), event(['Work'], 900), event([], 0)] },
    second: { cat_events: [] },
    third: { cat_events: [event(['Work'], 360), event(['Break'], 1)] },
  };
  const before = JSON.stringify(data);
  const result = buildBarchartDataset(data, [
    { name: ['Work'], rule: { type: 'none' }, data: { color: '#123456' } },
  ]);
  expect(result.map(d => d.label)).toEqual(['Work', 'Uncategorized', 'Break']);
  expect(result.map(d => d.data)).toEqual([
    [0.75, null, 0.1],
    [0, null, null],
    [null, null, 0],
  ]);
  expect(result[0].backgroundColor).toBe('#123456');
  expect(JSON.stringify(data)).toBe(before);
});

test('empty input produces no datasets', () => {
  expect(buildBarchartDataset([], [])).toEqual([]);
  expect(buildBarchartDataset(null, [])).toEqual([]);
});
