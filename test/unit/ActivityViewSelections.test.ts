import { mount } from '@vue/test-utils';
import { BFormInput, BFormSelect } from 'bootstrap-vue';
import { createPinia, setActivePinia } from 'pinia';
import ActivityView from '~/views/activity/ActivityView.vue';
import SelectableVisualization from '~/components/SelectableVisualization.vue';
import TopBucketData from '~/visualizations/TopBucketData.vue';
import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { useViewsStore } from '~/stores/views';

const mockGetEvents = jest.fn();
jest.mock('~/util/awclient', () => ({
  getClient: () => ({ getEvents: (...args) => mockGetEvents(...args) }),
}));

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const copy = value => JSON.parse(JSON.stringify(value));
const confirmed = [
  {
    id: 'summary',
    name: 'Summary',
    elements: [
      {
        type: 'top_bucket_data',
        props: { bucketId: 'first', field: '__custom', customField: 'title' },
      },
    ],
  },
];

function mountEditor() {
  const activity = useActivityStore();
  activity.$patch({
    buckets: { loaded: true },
    query_options: { timeperiod: { start: '2026-10-30T00:00:00Z', length: [1, 'day'] } },
  } as any);
  const buckets = useBucketsStore();
  buckets.$patch({ buckets: [{ id: 'first' }, { id: 'second' }] } as any);
  jest.spyOn(buckets, 'ensureLoaded').mockResolvedValue(undefined);
  const views = useViewsStore();
  views.loadViews(copy(confirmed));
  jest.spyOn(views, 'load').mockImplementation(async () => views.loadViews(copy(confirmed)));
  const wrapper = mount(ActivityView, {
    mocks: { $route: { params: {}, path: '/activity/view/default' }, $t: key => key },
    data: () => ({ editing: true }),
    directives: { 'b-modal': () => undefined },
    stubs: {
      draggable: { template: '<div><slot /></div>' },
      'aw-selectable-vis': SelectableVisualization,
      'aw-top-bucket-data': TopBucketData,
      'b-form-select': BFormSelect,
      'b-form-input': BFormInput,
      'b-button': {
        template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
      },
      'b-row': { template: '<div><slot /></div>' },
      'b-col': { template: '<div><slot /></div>' },
      'b-form-group': { template: '<div><slot /></div>' },
      'b-dropdown': true,
      'b-dropdown-item': true,
      'b-alert': true,
      'b-modal': true,
      'aw-summary': true,
      icon: true,
    },
  });
  return { wrapper, views };
}

beforeEach(() => {
  setActivePinia(createPinia());
  mockGetEvents
    .mockReset()
    .mockResolvedValue([{ duration: 10, data: { title: 'Example', app: 'Editor' } }]);
});
afterEach(() => jest.restoreAllMocks());

test('Cancel restores the rendered bucket, field and custom field, not only the store', async () => {
  const { wrapper, views } = mountEditor();
  await flush();
  const original = wrapper.findComponent(TopBucketData);
  await original.findAll('select').at(0).setValue('second');
  await flush();
  await original.find('input').setValue('app');
  await original.findAll('select').at(1).setValue('app');
  expect(views.views[0].elements[0].props.bucketId).toBe('second');

  await wrapper
    .findAll('button')
    .wrappers.find(b => b.text().includes('activityView.cancel'))
    .trigger('click');
  await flush();
  const restored = wrapper.findComponent(TopBucketData);
  expect((restored.findAll('select').at(0).element as HTMLSelectElement).value).toBe('first');
  expect((restored.findAll('select').at(1).element as HTMLSelectElement).value).toBe('__custom');
  expect((restored.find('input').element as HTMLInputElement).value).toBe('title');
  expect(views.views).toEqual(confirmed);
  wrapper.destroy();
});

test('a failed Cancel retains the current chart and editable selections', async () => {
  const { wrapper, views } = mountEditor();
  await flush();
  const original = wrapper.findComponent(TopBucketData);
  await original.find('input').setValue('app');
  jest.spyOn(views, 'load').mockRejectedValue(new Error('offline'));
  await wrapper
    .findAll('button')
    .wrappers.find(b => b.text().includes('activityView.cancel'))
    .trigger('click');
  await flush();
  expect(wrapper.findComponent(TopBucketData).vm).toBe(original.vm);
  expect((original.find('input').element as HTMLInputElement).value).toBe('app');
  expect(wrapper.find('button[variant="success"]').exists()).toBe(true);
  expect(original.find('input').attributes('disabled')).toBeUndefined();
  wrapper.destroy();
});

test('Restore defaults rebuilds same-position charts with the default selection', async () => {
  const { wrapper, views } = mountEditor();
  await flush();
  const original = wrapper.findComponent(TopBucketData);
  await original.find('input').setValue('app');
  jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  jest.spyOn(views, 'restoreDefaults').mockImplementation(() => views.loadViews(copy(confirmed)));
  await wrapper
    .findAll('button')
    .wrappers.find(b => b.text().includes('activityView.restoreDefaults'))
    .trigger('click');
  await flush();
  expect(wrapper.findComponent(TopBucketData).vm).not.toBe(original.vm);
  expect(
    (wrapper.findComponent(TopBucketData).find('input').element as HTMLInputElement).value
  ).toBe('title');
  wrapper.destroy();
});

test.each([false, true])(
  'Save locks every selection control and unlocks after rejection=%s',
  async reject => {
    const { wrapper, views } = mountEditor();
    await flush();
    let finish!: () => void;
    jest.spyOn(views, 'save').mockImplementation(
      () =>
        new Promise<void>((resolve, rejectSave) => {
          finish = reject ? () => rejectSave(new Error('offline')) : resolve;
        })
    );
    await wrapper.find('button[variant="success"]').trigger('click');
    const chart = wrapper.findComponent(TopBucketData);
    const controls = chart.findAll('select, input');
    expect(controls.length).toBe(3);
    controls.wrappers.forEach(control => expect(control.attributes('disabled')).toBeDefined());
    // A queued update must not mutate the snapshot while persistence is pending.
    chart.vm.$emit('update-props', { bucketId: 'second', field: 'app', customField: '' });
    await flush();
    expect(views.views).toEqual(confirmed);
    finish();
    await flush();
    chart
      .findAll('select, input')
      .wrappers.forEach(control => expect(control.attributes('disabled')).toBeUndefined());
    await chart.find('input').setValue('app');
    expect(views.views[0].elements[0].props.customField).toBe('app');
    wrapper.destroy();
  }
);

test.each([false, true])(
  'delayed field discovery is forwarded after Save unlocks, rejection=%s',
  async reject => {
    let resolveEvents!: (events: any[]) => void;
    mockGetEvents.mockReturnValue(
      new Promise<any[]>(resolve => {
        resolveEvents = resolve;
      })
    );
    const { wrapper, views } = mountEditor();
    await flush();
    const chart: any = wrapper.findComponent(TopBucketData);
    chart.vm.selectedField = '';
    await flush();
    expect(views.views[0].elements[0].props.field).toBe('');
    let finish!: () => void;
    jest.spyOn(views, 'save').mockImplementation(
      () =>
        new Promise<void>((resolve, rejectSave) => {
          finish = reject ? () => rejectSave(new Error('offline')) : resolve;
        })
    );
    await wrapper.find('button[variant="success"]').trigger('click');
    resolveEvents([{ duration: 10, data: { app: 'Editor' } }]);
    await flush();
    expect(chart.vm.selectedField).toBe('app');
    expect(views.views[0].elements[0].props.field).toBe('');
    finish();
    await flush();
    expect(views.views[0].elements[0].props.field).toBe('app');
    wrapper.destroy();
  }
);

test('a remounted editor observes the shared save lock', async () => {
  const { wrapper, views } = mountEditor();
  await flush();
  views.saving = true;
  await flush();
  expect(wrapper.find('button[variant="success"]').attributes('disabled')).toBeDefined();
  expect(wrapper.findComponent(TopBucketData).find('input').attributes('disabled')).toBeDefined();
  views.saving = false;
  await flush();
  expect(wrapper.find('button[variant="success"]').attributes('disabled')).toBeUndefined();
  wrapper.destroy();
});

test('reordered charts keep their own selections through Save unlock', async () => {
  const { wrapper, views } = mountEditor();
  views.views[0].elements.push({
    type: 'top_bucket_data',
    props: { bucketId: 'second', field: '__custom', customField: 'app' },
  });
  await flush();
  views.setElements({ view_id: 'summary', elements: [...views.views[0].elements].reverse() });
  await flush();
  const reordered = copy(views.views);
  jest.spyOn(views, 'save').mockResolvedValue(undefined);
  await wrapper.find('button[variant="success"]').trigger('click');
  await flush();
  expect(views.views).toEqual(reordered);
  const charts = wrapper.findAllComponents(TopBucketData);
  expect((charts.at(0).find('select').element as HTMLSelectElement).value).toBe('second');
  expect((charts.at(1).find('select').element as HTMLSelectElement).value).toBe('first');
  wrapper.destroy();
});
