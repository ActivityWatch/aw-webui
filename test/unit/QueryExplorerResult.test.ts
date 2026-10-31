import { createLocalVue, mount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import SelectableEventView from '~/components/SelectableEventView.vue';
import QueryExplorer from '~/views/QueryExplorer.vue';

const mockSettings = { ensureLoaded: jest.fn(), saved_queries: [] };
const mockCategories = { load: jest.fn(), classes_for_query: [] };

jest.mock('~/stores/settings', () => ({ useSettingsStore: () => mockSettings }));
jest.mock('~/stores/categories', () => ({ useCategoryStore: () => mockCategories }));

const localVue = createLocalVue();
localVue.use(BootstrapVue);
localVue.component('aw-selectable-eventview', SelectableEventView);

const event = {
  timestamp: '2026-10-31T12:00:00Z',
  duration: 12,
  data: { title: 'Code', app: 'Vim' },
};

describe('Query Explorer result-shape admission', () => {
  const wrappers = [];

  beforeEach(() => {
    mockCategories.classes_for_query = [];
    mockSettings.ensureLoaded.mockResolvedValue(undefined);
  });

  afterEach(() => {
    wrappers.forEach(wrapper => wrapper.destroy());
    wrappers.length = 0;
  });

  function mountExplorer(query = jest.fn()) {
    const wrapper: any = mount(QueryExplorer, {
      localVue,
      mocks: { $route: { query: { q: 'RETURN = 42;' } }, $aw: { query } },
      stubs: {
        icon: true,
        'vis-timeline': true,
        'aw-summary': true,
        'aw-eventlist': {
          name: 'EventListStub',
          props: ['events'],
          template: '<div class="eventlist-stub" />',
        },
      },
    });
    wrappers.push(wrapper);
    return wrapper;
  }

  test('Run of an event array still uses EventList', async () => {
    const wrapper = mountExplorer(jest.fn().mockResolvedValue([[event]]));
    await wrapper.vm.query();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain('Number of events: 1');
    expect(wrapper.find('.eventlist-stub').exists()).toBe(true);
    expect(wrapper.find('pre.result-fallback').exists()).toBe(false);
  });

  test.each([
    [42, '42'],
    [{ total: 42 }, '"total": 42'],
    [null, 'null'],
    [[1, 2], '1'],
    [[{ duration: 5, label: 'total' }], '"label": "total"'],
    [[{ ...event, data: null }], '"data": null'],
  ])('Run of non-event result %p uses JSON fallback', async (value, snippet) => {
    const wrapper = mountExplorer(jest.fn().mockResolvedValue([value]));
    await wrapper.vm.query();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).not.toContain('Number of events:');
    expect(wrapper.find('.eventlist-stub').exists()).toBe(false);
    expect(wrapper.find('pre.result-fallback').text()).toContain(snippet);
  });
});
