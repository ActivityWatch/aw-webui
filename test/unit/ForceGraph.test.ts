import { mount } from '@vue/test-utils';
import ForceGraph from '~/visualizations/ForceGraph.vue';

const data = {
  nodes: ['A', 'B', 'C', 'D'].map((id, i) => ({
    id: `Work>${id}`,
    color: '#336699',
    value: 600 * (i + 1),
  })),
  links: [
    { source: 'Work>A', target: 'Work>B', value: 3 },
    { source: 'Work>B', target: 'Work>C', value: 1 },
    { source: 'Work>C', target: 'Work>D', value: 2 },
  ],
};

describe('ForceGraph', () => {
  let resizeCallback;
  let containerWidth;

  beforeEach(() => {
    containerWidth = 341;
    jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
      return this.id === 'forcegraph' ? containerWidth : 0;
    });
    (global as any).ResizeObserver = class {
      constructor(cb) {
        resizeCallback = cb;
      }
      observe = jest.fn();
      disconnect = jest.fn();
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete global.ResizeObserver;
  });

  test('renders explicit category labels and titles independently of opaque IDs', () => {
    const graphData = {
      nodes: [
        {
          id: '["Work>Code"]',
          label: 'Work>Code',
          title: 'Work>Code',
          color: '#336699',
          value: 60,
        },
        {
          id: '["Work","Code"]',
          label: 'Code',
          title: 'Work > Code',
          color: '#336699',
          value: 120,
        },
      ],
      links: [{ source: '["Work>Code"]', target: '["Work","Code"]', value: 1 }],
    };
    const wrapper = mount(ForceGraph, { propsData: { data: graphData }, attachTo: document.body });
    expect([...wrapper.element.querySelectorAll('text')].map(t => t.textContent)).toEqual([
      'Work>Code',
      'Code',
    ]);
    expect([...wrapper.element.querySelectorAll('title')].map(t => t.textContent)).toEqual([
      'Work>Code',
      'Work > Code',
    ]);
    expect(wrapper.element.querySelectorAll('circle')).toHaveLength(2);
    expect(wrapper.element.querySelectorAll('line')).toHaveLength(1);
    wrapper.destroy();
  });

  test('draws at the container width and redraws when it changes', () => {
    const wrapper = mount(ForceGraph, { propsData: { data }, attachTo: document.body });
    expect(wrapper.element.querySelector('svg').getAttribute('width')).toBe('341');

    containerWidth = 1090;
    resizeCallback();
    // Capped at the default 640px.
    expect(wrapper.element.querySelector('svg').getAttribute('width')).toBe('640');
    expect(wrapper.element.querySelectorAll('svg')).toHaveLength(1);
    wrapper.destroy();
  });

  test('labels each node, on the side facing the center', async () => {
    const wrapper = mount(ForceGraph, { propsData: { data }, attachTo: document.body });
    // Let the force simulation tick.
    await new Promise(resolve => setTimeout(resolve, 300));

    const svg = wrapper.element.querySelector('svg');
    const circles = [...svg.querySelectorAll('circle')];
    const labels = [...svg.querySelectorAll('text')];
    expect(labels.map(t => t.textContent)).toEqual(['A', 'B', 'C', 'D']);
    expect([...svg.querySelectorAll('title')].map(t => t.textContent)).toEqual(
      data.nodes.map(n => n.id)
    );
    circles.forEach((c, i) => {
      const cx = +c.getAttribute('cx');
      const r = +c.getAttribute('r');
      const x = +labels[i].getAttribute('x');
      if (cx > 0) {
        expect(labels[i].getAttribute('text-anchor')).toBe('end');
        expect(x).toBeCloseTo(cx - r - 3);
      } else {
        expect(labels[i].getAttribute('text-anchor')).toBe('start');
        expect(x).toBeCloseTo(cx + r + 3);
      }
    });
    wrapper.destroy();
  });
});
