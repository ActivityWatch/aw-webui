import Vue from 'vue';
import { createLocalVue, shallowMount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import Graph from '~/views/Graph.vue';
import { getClient as getClientImpl } from '~/util/awclient';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

const getClient = getClientImpl as jest.Mock;

const mockCategoryStore = {
  load: jest.fn().mockResolvedValue(undefined),
  classes_for_query: [] as [string[], unknown][],
  get_category_color: jest.fn(() => '#336699'),
};

const mockBucketsStore = {
  desktopBucketIds: jest.fn((host: string) => ({
    bid_window: `aw-watcher-window_${host}`,
    bid_afk: `aw-watcher-afk_${host}`,
  })),
};

jest.mock('~/stores/categories', () => ({
  useCategoryStore: () => mockCategoryStore,
}));

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => mockBucketsStore,
}));

const localVue = createLocalVue();
localVue.use(BootstrapVue);

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await Vue.nextTick();
};

const event = (name: string) => ({
  timestamp: '2026-01-01T12:00:00Z',
  duration: 60,
  data: { title: `TITLE_${name}`, app: `APP_${name}`, $category: [name] },
});

describe('Graph Generate invocation ownership', () => {
  const wrappers: Array<{ destroy: () => void }> = [];

  beforeEach(() => {
    mockCategoryStore.load.mockResolvedValue(undefined);
    mockCategoryStore.classes_for_query = [];
    mockCategoryStore.get_category_color.mockReturnValue('#336699');
    mockBucketsStore.desktopBucketIds.mockImplementation((host: string) => ({
      bid_window: `aw-watcher-window_${host}`,
      bid_afk: `aw-watcher-afk_${host}`,
    }));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    wrappers.forEach(wrapper => wrapper.destroy());
    wrappers.length = 0;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  function mountGraph(query = jest.fn()) {
    getClient.mockReturnValue({ query });
    const wrapper: any = shallowMount(Graph, {
      localVue,
      stubs: {
        icon: true,
        'aw-query-options': true,
        'aw-force-graph': {
          name: 'ForceGraphStub',
          props: ['data'],
          render(h) {
            return h('pre', { class: 'graph-data' }, JSON.stringify(this.data));
          },
        },
      },
    });
    wrappers.push(wrapper);
    wrapper.setData({
      queryOptions: {
        hostname: 'OLD',
        filter_afk: true,
        start: '2026-01-01',
        stop: '2026-01-02',
      },
    });
    return wrapper;
  }

  async function overlappingGenerates() {
    const old = deferred<unknown[][]>();
    const recent = deferred<unknown[][]>();
    const query = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
    const wrapper = mountGraph(query);
    await flush();
    const first = wrapper.vm.generate();
    await wrapper.setData({
      queryOptions: {
        hostname: 'NEW',
        filter_afk: true,
        start: '2026-01-01',
        stop: '2026-01-02',
      },
    });
    const second = wrapper.vm.generate();
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0][0]).toContain('2026-01-01');
    expect(query.mock.calls[0][1].join('\n')).toContain('aw-watcher-window_OLD');
    expect(query.mock.calls[1][1].join('\n')).toContain('aw-watcher-window_NEW');
    return { wrapper, old, recent, first, second };
  }

  function nodeIds(wrapper: any): string[] {
    return (wrapper.vm.graphdata.nodes || []).map((node: { id: string }) => node.id);
  }

  test.each(['new-first', 'old-first'])(
    'only publishes the latest Generate success (%s)',
    async order => {
      const { wrapper, old, recent, first, second } = await overlappingGenerates();
      if (order === 'old-first') {
        old.resolve([[event('OLD')]]);
        await first;
        await flush();
        expect(wrapper.vm.queryOptions.hostname).toBe('NEW');
        expect(wrapper.vm.status).toBe('searching');
        expect(nodeIds(wrapper)).not.toEqual(['OLD']);
      }
      recent.resolve([[event('NEW')]]);
      await second;
      await flush();
      if (order === 'new-first') {
        old.resolve([[event('OLD')]]);
        await first;
        await flush();
      }
      expect(wrapper.vm.queryOptions.hostname).toBe('NEW');
      expect(nodeIds(wrapper)).toEqual(['NEW']);
      expect(wrapper.find('.graph-data').text()).toContain('"id":"NEW"');
      expect(wrapper.vm.error).toBe('');
      expect(wrapper.vm.status).toBeNull();
      expect(wrapper.vm.events).toEqual([event('NEW')]);
    }
  );

  test.each(['success', 'failure'])(
    'an obsolete %s cannot stop the pending spinner or replace current results',
    async outcome => {
      const { wrapper, old, recent, first, second } = await overlappingGenerates();
      if (outcome === 'success') old.resolve([[event('OLD')]]);
      else old.reject(new Error('OLD FAILURE'));
      await first;
      await flush();
      expect(wrapper.vm.status).toBe('searching');
      expect(wrapper.text()).toContain('Searching...');
      expect(nodeIds(wrapper)).not.toEqual(['OLD']);
      expect(wrapper.vm.error).toBe('');
      recent.resolve([[event('NEW')]]);
      await second;
      await flush();
      expect(wrapper.vm.status).toBeNull();
      expect(nodeIds(wrapper)).toEqual(['NEW']);
    }
  );

  test.each(['old-first', 'new-first'])(
    'an obsolete success cannot clear the current failure (%s)',
    async order => {
      const { wrapper, old, recent, first, second } = await overlappingGenerates();
      if (order === 'old-first') {
        old.resolve([[event('OLD')]]);
        await first;
        await flush();
      }
      recent.reject({ response: { data: { message: 'Current failure' } } });
      await expect(second).resolves.toBeUndefined();
      await flush();
      if (order === 'new-first') {
        old.resolve([[event('OLD')]]);
        await first;
        await flush();
      }
      expect(wrapper.vm.error).toBe('Current failure');
      expect(wrapper.find('b-alert-stub[variant="danger"]').text()).toBe('Current failure');
      expect(wrapper.vm.events).toBeNull();
      expect(wrapper.vm.graphdata).toEqual({});
      expect(wrapper.find('.graph-data').exists()).toBe(false);
      expect(wrapper.vm.status).toBeNull();
    }
  );

  test('an obsolete failure cannot replace the current failure', async () => {
    const { wrapper, old, recent, first, second } = await overlappingGenerates();
    recent.reject({ response: { data: { message: 'Current failure' } } });
    await expect(second).resolves.toBeUndefined();
    old.reject(new Error('Old offline failure'));
    await expect(first).resolves.toBeUndefined();
    await flush();
    expect(wrapper.vm.error).toBe('Current failure');
    expect(wrapper.vm.status).toBeNull();
  });

  test.each([
    [
      { response: { data: { message: 'Invalid query' } }, message: 'Request failed' },
      'Invalid query',
    ],
    [new Error('synthetic offline'), 'synthetic offline'],
    [{ response: {} }, 'The request failed.'],
    [null, 'The request failed.'],
    ['Connection lost', 'Connection lost'],
  ])('first failure settles without graphing null: %p', async (failure, message) => {
    const wrapper = mountGraph(jest.fn().mockRejectedValue(failure));
    await flush();
    await expect(wrapper.vm.generate()).resolves.toBeUndefined();
    await flush();
    expect(wrapper.vm.error).toBe(message);
    expect(wrapper.find('b-alert-stub[variant="danger"]').text()).toBe(message);
    expect(wrapper.vm.events).toBeNull();
    expect(wrapper.vm.graphdata).toEqual({});
    expect(wrapper.find('.graph-data').exists()).toBe(false);
    expect(wrapper.vm.status).toBeNull();
  });

  test('retry after first failure publishes the new graph', async () => {
    const retry = deferred<unknown[][]>();
    const query = jest
      .fn()
      .mockRejectedValueOnce(new Error('synthetic offline'))
      .mockReturnValueOnce(retry.promise);
    const wrapper = mountGraph(query);
    await flush();
    await expect(wrapper.vm.generate()).resolves.toBeUndefined();
    await flush();
    expect(wrapper.vm.error).toBe('synthetic offline');
    const second = wrapper.vm.generate();
    await flush();
    expect(wrapper.vm.status).toBe('searching');
    expect(wrapper.vm.error).toBe('');
    retry.resolve([[event('RETRY')]]);
    await second;
    await flush();
    expect(wrapper.vm.error).toBe('');
    expect(nodeIds(wrapper)).toEqual(['RETRY']);
    expect(wrapper.vm.events).toEqual([event('RETRY')]);
    expect(wrapper.vm.status).toBeNull();
  });

  test('leaves separator-joined category identities unchanged', () => {
    const wrapper = mountGraph();
    const data = wrapper.vm.generateGraphData([
      {
        timestamp: '2026-01-01T12:00:00Z',
        duration: 60,
        data: { $category: ['Work>Code'] },
      },
      {
        timestamp: '2026-01-01T12:01:00Z',
        duration: 120,
        data: { $category: ['Work', 'Code'] },
      },
    ]);
    // Master still joins with '>' so these two arrays collide as one node
    // and a false self-loop. ActivityWatch/aw-webui#1219 owns that identity
    // repair; this PR must not absorb it.
    expect(data.nodes).toHaveLength(1);
    expect(data.nodes[0].id).toBe('Work>Code');
    expect(data.nodes[0].value).toBe(180);
    expect(data.links).toEqual([{ source: 'Work>Code', target: 'Work>Code', value: 1 }]);
  });

  test('empty success completes without nodes or error', async () => {
    const wrapper = mountGraph(jest.fn().mockResolvedValue([[]]));
    await flush();
    await wrapper.vm.generate();
    await flush();
    expect(wrapper.vm.events).toEqual([]);
    expect(wrapper.vm.graphdata).toEqual({ nodes: [], links: [] });
    expect(wrapper.vm.error).toBe('');
    expect(wrapper.vm.status).toBeNull();
    expect(wrapper.text()).toContain('Found 0 events');
  });

  test('ordered success keeps hostname, duration and Generate button ownership', async () => {
    const old = deferred<unknown[][]>();
    const recent = deferred<unknown[][]>();
    const query = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
    const wrapper = mountGraph(query);
    await flush();
    const generate = wrapper.find('b-button-stub[variant="success"]');
    expect(generate.exists()).toBe(true);
    expect(generate.text()).toContain('Generate');
    await generate.trigger('click');
    await wrapper.setData({
      queryOptions: {
        hostname: 'NEW',
        filter_afk: true,
        start: '2026-01-01',
        stop: '2026-01-02',
      },
    });
    await generate.trigger('click');
    expect(query).toHaveBeenCalledTimes(2);
    recent.resolve([[event('NEW')]]);
    await flush();
    old.resolve([[event('OLD')]]);
    await flush();
    expect(wrapper.vm.queryOptions.hostname).toBe('NEW');
    expect(wrapper.text()).toContain('Hostname: NEW');
    expect(nodeIds(wrapper)).toEqual(['NEW']);
    expect(wrapper.text()).toContain('Found 1 events');
    expect(wrapper.find('.alert-danger').exists()).toBe(false);
  });
});
