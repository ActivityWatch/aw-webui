import { buildGraphData } from '~/util/graphData';
const event = (path, duration) => ({ timestamp: '', duration, data: { $category: path } });

test('sums seconds and directed transitions in encounter order without mutating events', () => {
  const events = [
    event(['Work', 'Code'], 1.5),
    event(['Work', 'Docs'], 2),
    event(['Break'], 3),
    event(['Work'], 4),
    event(['Break'], 5),
  ];
  const before = JSON.stringify(events);
  const result = buildGraphData(events, 1, path => path[0]);
  expect(result.nodes.map(n => n.value)).toEqual([7.5, 8]);
  expect(result.nodes.map(n => n.color)).toEqual(['Work', 'Break']);
  expect(result.links).toEqual([
    { source: '["Work"]', target: '["Break"]', value: 2 },
    { source: '["Break"]', target: '["Work"]', value: 1 },
  ]);
  expect(JSON.stringify(events)).toBe(before);
});

test('category names containing separators remain distinct', () => {
  const result = buildGraphData([event(['A>B'], 1), event(['A', 'B'], 2)], 3, () => 'gray');
  expect(new Set(result.nodes.map(n => n.id)).size).toBe(2);
  expect(result.links).toHaveLength(1);
});

test('handles an empty graph', () => {
  expect(buildGraphData([], 3, () => 'gray')).toEqual({ nodes: [], links: [] });
});
