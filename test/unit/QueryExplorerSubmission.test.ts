import { createLocalVue, shallowMount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import moment from 'moment';
import QueryExplorer from '~/views/QueryExplorer.vue';

const mockSettings = { ensureLoaded: jest.fn(), saved_queries: [] };
const mockCategories = { load: jest.fn(), classes_for_query: [] };

jest.mock('~/stores/settings', () => ({ useSettingsStore: () => mockSettings }));
jest.mock('~/stores/categories', () => ({ useCategoryStore: () => mockCategories }));

const localVue = createLocalVue();
localVue.use(BootstrapVue);

function deferred() {
  let resolve: (value: any) => void;
  let reject: (error: any) => void;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const oldEvents = [{ duration: 10, data: { title: 'Old' } }];
const newEvents = [{ duration: 20, data: { title: 'New' } }];
const initialEvents = [{ duration: 30, data: { title: 'Initial' } }];

describe('Query Explorer submission ownership', () => {
  const wrappers = [];

  beforeEach(() => {
    mockCategories.classes_for_query = [];
    mockSettings.ensureLoaded.mockResolvedValue(undefined);
  });

  afterEach(() => {
    wrappers.forEach(wrapper => wrapper.destroy());
    wrappers.length = 0;
    jest.clearAllMocks();
  });

  function mountExplorer(query = jest.fn()) {
    const wrapper: any = shallowMount(QueryExplorer, {
      localVue,
      mocks: { $route: { query: { q: 'RETURN = "old";' } }, $aw: { query } },
      stubs: {
        icon: true,
        'aw-selectable-eventview': {
          name: 'EventResults',
          props: ['events', 'event_type'],
          template: '<div />',
        },
      },
    });
    wrappers.push(wrapper);
    return wrapper;
  }

  async function overlappingQueries() {
    const old = deferred();
    const recent = deferred();
    const query = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
    const wrapper = mountExplorer(query);
    await wrapper.setData({ events: initialEvents });
    const first = wrapper.vm.query();
    await wrapper.setData({ query_code: 'RETURN = "new";' });
    const second = wrapper.vm.query();
    expect(query).toHaveBeenCalledTimes(2);
    return { wrapper, old, recent, first, second };
  }

  test.each(['old-first', 'new-first'])('only publishes the latest success (%s)', async order => {
    const { wrapper, old, recent, first, second } = await overlappingQueries();
    if (order === 'old-first') {
      old.resolve([oldEvents]);
      await first;
      expect(wrapper.vm.events).toEqual(initialEvents);
    }
    recent.resolve([newEvents]);
    await second;
    if (order === 'new-first') {
      old.resolve([oldEvents]);
      await first;
    }
    expect(wrapper.vm.events).toEqual(newEvents);
    expect(wrapper.vm.error).toBe('');
  });

  test.each(['old-first', 'new-first'])(
    'ignores an obsolete failure around the latest success (%s)',
    async order => {
      const { wrapper, old, recent, first, second } = await overlappingQueries();
      if (order === 'old-first') {
        old.reject({ response: { data: { message: 'Old failure' } } });
        await first;
        expect(wrapper.vm.error).toBe('');
      }
      recent.resolve([newEvents]);
      await second;
      if (order === 'new-first') {
        old.reject({ response: { data: { message: 'Old failure' } } });
        await first;
      }
      expect(wrapper.vm.events).toEqual(newEvents);
      expect(wrapper.vm.error).toBe('');
    }
  );

  test.each(['old-first', 'new-first'])(
    'an obsolete success cannot clear the current failure (%s)',
    async order => {
      const { wrapper, old, recent, first, second } = await overlappingQueries();
      if (order === 'old-first') {
        old.resolve([oldEvents]);
        await first;
        expect(wrapper.vm.events).toEqual(initialEvents);
      }
      recent.reject({ response: { data: { message: 'Current failure' } } });
      await second;
      if (order === 'new-first') {
        old.resolve([oldEvents]);
        await first;
      }
      expect(wrapper.vm.events).toEqual(initialEvents);
      expect(wrapper.vm.error).toBe('Current failure');
    }
  );

  test('an obsolete failure cannot replace the current failure', async () => {
    const { wrapper, old, recent, first, second } = await overlappingQueries();
    recent.reject({ response: { data: { message: 'Current failure' } } });
    await second;
    old.reject(new Error('Old offline failure'));
    await expect(first).resolves.toBeUndefined();
    expect(wrapper.vm.error).toBe('Current failure');
  });

  test.each([
    [
      { response: { data: { message: 'Invalid query' } }, message: 'Request failed' },
      'Invalid query',
    ],
    [new Error('offline'), 'offline'],
    [{ response: {} }, 'The query request failed.'],
    [null, 'The query request failed.'],
    [undefined, 'The query request failed.'],
    ['Connection lost', 'Connection lost'],
  ])('handles a current failure safely: %p', async (failure, message) => {
    const wrapper = mountExplorer(jest.fn().mockRejectedValue(failure));
    await wrapper.setData({ events: initialEvents });
    await expect(wrapper.vm.query()).resolves.toBeUndefined();
    expect(wrapper.vm.error).toBe(message);
    expect(wrapper.find('.alert-danger').text()).toBe(message);
    expect(wrapper.vm.events).toEqual(initialEvents);
  });

  test.each(['success', 'failure'])(
    'a newer category validation failure supersedes a pending %s',
    async outcome => {
      const request = deferred();
      const query = jest.fn().mockReturnValue(request.promise);
      const wrapper = mountExplorer(query);
      const first = wrapper.vm.query();
      await wrapper.setData({ query_code: 'RETURN = __CATEGORIES__;' });
      await wrapper.vm.query();
      const message = '__CATEGORIES__ was used in query but no categories have been defined yet.';
      expect(wrapper.vm.error).toBe(message);
      expect(query).toHaveBeenCalledTimes(1);
      if (outcome === 'success') request.resolve([oldEvents]);
      else request.reject({ response: { data: { message: 'Obsolete failure' } } });
      await first;
      expect(wrapper.vm.events).toEqual([]);
      expect(wrapper.vm.error).toBe(message);
    }
  );

  test('preserves category expansion, quoted semicolons, dates and non-event results', async () => {
    mockCategories.classes_for_query = [['Work', { type: 'regex', regex: 'Code' }]];
    const query = jest.fn().mockResolvedValue([42]);
    const wrapper = mountExplorer(query);
    await wrapper.setData({
      query_code: 'categories = __CATEGORIES__; RETURN = "a;b";',
      startdate: '2026-10-01',
      enddate: '2026-10-03',
      error: 'Previous failure',
    });
    await wrapper.vm.query();
    expect(query).toHaveBeenCalledWith(
      [moment('2026-10-01').format() + '/' + moment('2026-10-03').format()],
      ['categories = [["Work",{"type":"regex","regex":"Code"}]];', 'RETURN = "a;b";']
    );
    expect(wrapper.vm.events).toBe(42);
    expect(wrapper.vm.error).toBe('');
  });

  test('Run and Ctrl-Enter share latest-submission ownership in the mounted view', async () => {
    const old = deferred();
    const recent = deferred();
    const query = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
    const wrapper = mountExplorer(query);
    const run = wrapper.find('.form-inline button');
    await run.trigger('click');
    await wrapper.find('textarea').setValue('RETURN = "new";');
    await wrapper
      .find('textarea')
      .trigger('keypress', { key: 'Enter', keyCode: 13, ctrlKey: true });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1]).toEqual(['RETURN = "old";']);
    expect(query.mock.calls[1][1]).toEqual(['RETURN = "new";']);

    recent.resolve([newEvents]);
    await recent.promise;
    await wrapper.vm.$nextTick();
    old.resolve([oldEvents]);
    await old.promise;
    await wrapper.vm.$nextTick();

    expect(wrapper.find('textarea').element.value).toBe('RETURN = "new";');
    expect(wrapper.findComponent({ name: 'EventResults' }).props('events')).toEqual(newEvents);
    expect(wrapper.text()).toContain('Number of events: 1');
    expect(wrapper.find('.alert-danger').exists()).toBe(false);
  });
});
