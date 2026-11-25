import { createLocalVue, mount } from '@vue/test-utils';
import { createPinia, setActivePinia, PiniaVuePlugin } from 'pinia';
import SelectableEventView from '~/components/SelectableEventView.vue';
import Summary from '~/visualizations/Summary.vue';
import { useCategoryStore } from '~/stores/categories';

const events = [
  { timestamp: '2026-01-01T00:00:00Z', duration: 60, data: { title: 'A', app: 'editor' } },
  { timestamp: '2026-01-01T00:01:00Z', duration: 600, data: { title: 'B', app: 'browser' } },
  { timestamp: '2026-01-01T00:11:00Z', duration: 60, data: { title: 'A', app: 'browser' } },
];

function makeView(inputEvents = events) {
  const localVue = createLocalVue();
  localVue.use(PiniaVuePlugin);
  const pinia = createPinia();
  setActivePinia(pinia);
  localVue.component('aw-summary', Summary);
  return mount(SelectableEventView, {
    localVue,
    pinia,
    propsData: { events: inputEvents },
    mocks: { $t: key => key },
    stubs: {
      'aw-eventlist': { name: 'EventListStub', props: ['events'], template: '<div />' },
      'vis-timeline': { name: 'TimelineStub', props: ['buckets'], template: '<div />' },
      'b-button': true,
      icon: true,
    },
  });
}

describe('SelectableEventView summary', () => {
  test('groups repeated titles, sorts totals, and renders bars within 100%', async () => {
    const original = JSON.parse(JSON.stringify(events));
    const wrapper = makeView();
    await wrapper.setData({ vis_method: 'summary' });
    const summary = wrapper.findComponent(Summary);
    expect(summary.props('fields').map(e => [e.data.title, e.duration])).toEqual([
      ['B', 600],
      ['A', 120],
    ]);
    expect(
      wrapper.findAll('svg > g > rect').wrappers.map(rect => rect.attributes('width'))
    ).toEqual(['100%', '20%']);
    expect(events).toEqual(original);
    expect(wrapper.props('events')).toBe(events);
    wrapper.destroy();
  });

  test('regroups when a different data key is selected and keeps raw views unchanged', async () => {
    const wrapper = makeView();
    await wrapper.setData({ vis_method: 'summary' });
    await wrapper.find('input').setValue('app');
    await wrapper.find('input').trigger('change');
    await wrapper.vm.$nextTick();
    expect(
      wrapper
        .findComponent(Summary)
        .props('fields')
        .map(e => [e.data.app, e.duration])
    ).toEqual([
      ['browser', 660],
      ['editor', 60],
    ]);
    expect(wrapper.findAll('svg > g > rect').at(0).attributes('width')).toBe('100%');
    await wrapper.setData({ vis_method: 'eventlist' });
    expect(wrapper.findComponent({ name: 'EventListStub' }).props('events')).toBe(events);
    expect(wrapper.props('events')).toBe(events);
    await wrapper.setData({ vis_method: 'timeline' });
    expect(wrapper.findComponent({ name: 'TimelineStub' }).props('buckets')[0].events).toBe(events);
    wrapper.destroy();
  });

  test('keeps category arrays with comma-containing elements separate', async () => {
    const input = [
      { ...events[0], data: { title: 'A', app: 'editor', $category: ['Work,Email'] } },
      { ...events[1], data: { title: 'B', app: 'browser', $category: ['Work', 'Email'] } },
    ];
    const wrapper = makeView(input);
    useCategoryStore().classes.push(
      ...[['Work'], ['Work', 'Email'], ['Work,Email']].map(name => ({
        name,
        rule: { type: 'none' as const },
        data: { color: '#123456' },
      }))
    );
    await wrapper.setData({ vis_method: 'summary', summaryKey: '$category' });
    expect(
      wrapper
        .findComponent(Summary)
        .props('fields')
        .map(e => [e.data.$category, e.duration])
    ).toEqual([
      [['Work', 'Email'], 600],
      [['Work,Email'], 60],
    ]);
    expect(wrapper.findAll('svg > g > rect').length).toBe(2);
    wrapper.destroy();
  });

  test('groups equivalent JSON objects recursively while preserving array order', async () => {
    const first = { project: 'A', details: [{ team: 'B', tags: ['one', 'two'] }] };
    const reordered = { details: [{ tags: ['one', 'two'], team: 'B' }], project: 'A' };
    const different = { project: 'A', details: [{ team: 'B', tags: ['two', 'one'] }] };
    const input = [first, reordered, different].map((metadata, index) => ({
      ...events[index],
      duration: 60,
      data: { ...events[index].data, metadata },
    }));
    const original = JSON.stringify(input);
    const wrapper = makeView(input);
    await wrapper.setData({ summaryKey: 'metadata' });
    expect((wrapper.vm as any).summaryEvents.map(e => [e.data.metadata, e.duration])).toEqual([
      [first, 120],
      [different, 60],
    ]);
    expect(JSON.stringify(input)).toBe(original);
    wrapper.destroy();
  });

  test('skips non-positive durations before summing and omits non-positive-only groups', async () => {
    const input = [
      events[0],
      { ...events[0], duration: -60 },
      { ...events[1], duration: 0 },
      { ...events[2], duration: -1, data: { title: 'C', app: 'editor' } },
    ];
    const wrapper = makeView(input);
    await wrapper.setData({ vis_method: 'summary' });
    expect(
      wrapper
        .findComponent(Summary)
        .props('fields')
        .map(e => [e.data.title, e.duration])
    ).toEqual([['A', 60]]);
    expect(
      wrapper.findAll('svg > g > rect').wrappers.map(rect => rect.attributes('width'))
    ).toEqual(['100%']);
    wrapper.destroy();
  });
});
