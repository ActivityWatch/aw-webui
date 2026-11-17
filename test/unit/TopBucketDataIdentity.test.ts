import { shallowMount } from '@vue/test-utils';
import Component from '~/visualizations/TopBucketData.vue';

const TopBucketData: any = Component;
jest.mock('~/stores/activity', () => ({ useActivityStore: () => ({ query_options: {} }) }));
jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({ buckets: [], ensureLoaded: jest.fn().mockResolvedValue(undefined) }),
}));

function aggregate(values: unknown[], field = 'value') {
  const vm = {
    selectedFieldValue: field,
    events: values.map((value, i) => ({ duration: (i + 1) * 60, data: { value } })),
    aggregated: [] as any[],
  };
  TopBucketData.methods.aggregate.call(vm);
  return vm.aggregated;
}

test.each([
  ['missing', undefined, 'Unknown'],
  ['null', null, 'Unknown'],
  ['boolean', false, 'false'],
  ['number', 1, '1'],
  ['object', { a: 1 }, '{"a":1}'],
  ['array', ['Work'], '["Work"]'],
  ['array display', ['Work'], 'Work'],
  ['array separator', ['A', 'B'], ['A > B']],
  ['array element types', [1], ['1']],
])('%s retains distinct typed groups and distinguishable labels', (_name, first, second) => {
  const rows = aggregate([first, second]);
  expect(rows).toHaveLength(2);
  expect(rows.map(row => row.duration)).toEqual([120, 60]);
  expect(new Set(rows.map(row => row.data.display)).size).toBe(2);
  expect(rows.reduce((total, row) => total + row.duration, 0)).toBe(180);
});

test.each([
  ['string', 'A', 'A'],
  ['unknown', undefined, null],
  ['object key order', { a: 1, b: { c: 2, d: 3 } }, { b: { d: 3, c: 2 }, a: 1 }],
  ['array objects', [{ a: 1, b: 2 }], [{ b: 2, a: 1 }]],
  ['array', ['Work', 'Code'], ['Work', 'Code']],
])('%s equal values still aggregate', (_name, first, second) => {
  const rows = aggregate([first, second]);
  expect(rows).toHaveLength(1);
  expect(rows[0].duration).toBe(180);
});

test('array order remains meaningful', () => {
  expect(
    aggregate([
      ['A', 'B'],
      ['B', 'A'],
    ])
  ).toHaveLength(2);
});

test('ordinary strings retain names and color keys, even prototype-looking names', () => {
  const rows = aggregate(['__proto__', 'constructor', 'A']);
  expect(rows.map(row => row.data.display)).toEqual(['A', 'constructor', '__proto__']);
  expect(rows.map(row => row.data.colorKey)).toEqual(['A', 'constructor', '__proto__']);
});

test('generated labels do not collide with literal strings or same-type array labels', () => {
  const rows = aggregate([1, '1', '1 (number)', ['A > B'], ['A', 'B'], 'A > B (array)']);
  expect(rows).toHaveLength(6);
  expect(new Set(rows.map(row => row.data.display)).size).toBe(6);
});

test('annotations preserve original color keys and reserve literal annotation spellings', () => {
  const rows = aggregate([1, '1', '1 (number)', ['Work'], 'Work', null, 'Unknown']);
  const number = rows.find(row => row.data.raw === 1);
  expect(number.data).toMatchObject({ display: '1 (number) #2', colorKey: '1' });
  const array = rows.find(row => Array.isArray(row.data.raw));
  expect(array.data).toMatchObject({ display: '["Work"] (array)', colorKey: 'Work' });
  const unknown = rows.find(row => row.data.raw === null);
  expect(unknown.data).toMatchObject({ display: 'Unknown (unknown)', colorKey: 'Unknown' });
  expect(rows.filter(row => typeof row.data.raw === 'string').map(row => row.data.display)).toEqual(
    ['Unknown', 'Work', '1 (number)', '1']
  );
});

test.each(['nested.value', 'data.nested.value'])(
  'nested custom path %s preserves totals',
  field => {
    const vm = {
      selectedFieldValue: field,
      events: [
        { duration: 60, data: { nested: { value: false } } },
        { duration: 120, data: { nested: { value: 'false' } } },
      ],
      aggregated: [] as any[],
    };
    TopBucketData.methods.aggregate.call(vm);
    expect(vm.aggregated.map(row => row.duration)).toEqual([120, 60]);
  }
);

test('mounted widget passes distinct labels and hover text to its summary across field selection', async () => {
  // Avoid backend loading: this test exercises the real computed props, watchers and template.
  const wrapper = shallowMount(TopBucketData, {
    propsData: { initialBucketId: 'bucket', initialField: 'value' },
    methods: { loadEvents: jest.fn(), setDefaultBucket: jest.fn() },
    mocks: { $t: (key: string) => key },
    stubs: {
      'b-row': true,
      'b-col': true,
      'b-form-group': true,
      'b-form-select': true,
      'b-form-input': true,
      'b-alert': true,
      'aw-summary': {
        name: 'aw-summary',
        props: ['fields', 'namefunc', 'hoverfunc', 'colorfunc'],
        template:
          '<div><span v-for="(row, i) in fields" :key="i" :title="hoverfunc(row)">{{ namefunc(row) }}</span></div>',
      },
    },
  });
  try {
    await wrapper.setData({
      events: [
        { duration: 60, data: { value: 1, nested: { value: false } } },
        { duration: 120, data: { value: '1', nested: { value: 'false' } } },
      ],
    });
    (wrapper.vm as any).aggregate();
    await wrapper.vm.$nextTick();
    const summaryLabels = () => {
      const props = wrapper.findComponent({ name: 'aw-summary' }).props();
      expect(props.fields).toHaveLength(2);
      expect(props.fields.map(props.namefunc)).toEqual(props.fields.map(props.hoverfunc));
      const labels = props.fields.map(props.namefunc);
      const spans = wrapper.findAll('span[title]');
      expect(spans.wrappers.map(span => span.text())).toEqual(labels);
      expect(spans.wrappers.map(span => span.attributes('title'))).toEqual(labels);
      return labels;
    };
    expect(new Set(summaryLabels()).size).toBe(2);
    await wrapper.setData({ selectedField: '__custom', customField: 'data.nested.value' });
    expect(new Set(summaryLabels()).size).toBe(2);
    expect(summaryLabels().join(' ')).toContain('false');
    await wrapper.setData({ customField: '' });
    expect(wrapper.findComponent({ name: 'aw-summary' }).exists()).toBe(false);
  } finally {
    wrapper.destroy();
  }
});
