import GraphComponent from '~/views/Graph.vue';

const Graph: any = GraphComponent;

function graph(categories: string[][], maxDepth = 10) {
  const get_category_color = jest.fn(category => JSON.stringify(category));
  const events = categories.map((category, i) => ({
    timestamp: '2026-10-01T00:00:00Z',
    duration: (i + 1) * 60,
    data: { $category: category },
  }));
  const data = Graph.methods.generateGraphData.call(
    { maxDepth, categoryStore: { get_category_color } },
    events
  );
  return { ...data, get_category_color, events };
}

describe('Graph category identity', () => {
  test('keeps literal separators distinct from category hierarchy', () => {
    const { nodes, links, get_category_color } = graph([['Work>Code'], ['Work', 'Code']]);
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.value)).toEqual([60, 120]);
    expect(nodes[0].id).not.toBe(nodes[1].id);
    expect(nodes[0].group).not.toBe(nodes[1].group);
    expect(nodes.map(n => n.label)).toEqual(['Work>Code', 'Code']);
    expect(get_category_color.mock.calls).toEqual([[['Work>Code']], [['Work', 'Code']]]);
    expect(links).toEqual([{ source: nodes[0].id, target: nodes[1].id, value: 1 }]);
  });

  test('counts repeated directed transitions without adding same-category links', () => {
    const { nodes, links } = graph([
      ['Work', 'Code>Review'],
      ['Work>Code', 'Review'],
      ['Work', 'Code>Review'],
      ['Work', 'Code>Review'],
      ['Work>Code', 'Review'],
    ]);
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.value)).toEqual([480, 420]);
    expect(nodes[0].group).not.toBe(nodes[1].group);
    expect(links).toEqual([
      { source: nodes[0].id, target: nodes[1].id, value: 2 },
      { source: nodes[1].id, target: nodes[0].id, value: 1 },
    ]);
  });

  test('clips depth before grouping and retains input arrays', () => {
    const categories = [['Work', 'Code'], ['Work', 'Review'], ['Work>Code']];
    const { nodes, links, events, get_category_color } = graph(categories, 1);
    expect(nodes).toHaveLength(2);
    expect(nodes.map(n => n.value)).toEqual([180, 180]);
    expect(get_category_color.mock.calls).toEqual([[['Work']], [['Work>Code']]]);
    expect(links).toEqual([{ source: nodes[0].id, target: nodes[1].id, value: 1 }]);
    expect(events.map(e => e.data.$category)).toEqual(categories);
  });

  test('preserves ordinary categories, parent groups and uncategorized', () => {
    const { nodes, links } = graph([
      ['Uncategorized'],
      ['Work', 'Code'],
      ['Work', 'Review'],
      ['Leisure'],
    ]);
    expect(nodes.map(n => n.value)).toEqual([60, 120, 180, 240]);
    expect(nodes.map(n => n.group)).toEqual([0, 1, 1, 2]);
    expect(links).toHaveLength(3);
    expect(new Set(nodes.map(n => n.id)).size).toBe(4);
    expect(graph([])).toMatchObject({ nodes: [], links: [] });
  });

  test('does not collide on quotes, backslashes or object-property names', () => {
    const { nodes } = graph([['a"', 'b\\c'], ['a">b\\c'], ['__proto__'], ['constructor']]);
    expect(new Set(nodes.map(n => n.id)).size).toBe(4);
    expect(new Set(nodes.map(n => n.group)).size).toBe(4);
  });
});
