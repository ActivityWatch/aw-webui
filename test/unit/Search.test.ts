import Vue from 'vue';
import moment from 'moment';
import { createLocalVue, shallowMount } from '@vue/test-utils';
import { BButton, BFormInput } from 'bootstrap-vue';
import SearchComponent from '~/views/Search.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const Search: any = SearchComponent;

const mockBuckets = {
  ensureLoaded: jest.fn(),
  desktopBucketIds: jest.fn(),
  bucketsBrowser: jest.fn(),
};

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => mockBuckets,
}));

const browserEvent = {
  timestamp: '2026-10-16T12:00:00Z',
  duration: 10,
  data: { url: 'https://example.com', title: 'Example' },
};
const windowEvent = {
  timestamp: '2026-10-16T11:00:00Z',
  duration: 20,
  data: { app: 'Firefox', title: 'Example', $category: ['searched'] },
};

function searchVm(query) {
  return {
    ...Search.data(),
    pattern: 'example',
    queryOptions: {
      hostname: 'browser-only',
      start: '2026-10-16',
      stop: '2026-10-17',
      filter_afk: true,
    },
    $aw: { query },
  };
}

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await Vue.nextTick();
};

const hit = title => ({ ...windowEvent, data: { ...windowEvent.data, title } });

describe('Search query failure isolation and request ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuckets.ensureLoaded.mockResolvedValue(undefined);
    mockBuckets.desktopBucketIds.mockReturnValue({
      bid_window: 'aw-watcher-window_browser-only',
      bid_afk: 'aw-watcher-afk_browser-only',
    });
    mockBuckets.bucketsBrowser.mockReturnValue(['aw-watcher-web-firefox_browser-only']);
    jest.spyOn(console, 'error').mockReturnValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('an older success cannot replace newer results or partial-failure errors', async () => {
    const oldWindow = deferred();
    const oldBrowser = deferred();
    const query = jest
      .fn()
      .mockReturnValueOnce(oldWindow.promise)
      .mockReturnValueOnce(oldBrowser.promise)
      .mockResolvedValueOnce([[hit('new')]])
      .mockRejectedValueOnce(new Error('new browser failure'));
    const vm = searchVm(query);
    const older = Search.methods.search.call(vm);
    await flush();
    vm.pattern = 'new';
    await Search.methods.search.call(vm);
    const latest = { events: vm.events, browserEvents: vm.browserEvents, error: vm.error };
    expect(vm.events[0].data.title).toBe('new');
    expect(vm.error).toContain('new browser failure');

    oldWindow.resolve([[hit('old')]]);
    oldBrowser.resolve([[browserEvent]]);
    await older;

    expect({ events: vm.events, browserEvents: vm.browserEvents, error: vm.error }).toEqual(latest);
    expect(vm.status).toBeNull();
  });

  test.each(['resolve', 'reject'])(
    'an older %s cannot clear loading or report errors',
    async finish => {
      mockBuckets.bucketsBrowser.mockReturnValue([]);
      const old = deferred();
      const current = deferred();
      const query = jest.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
      const vm = searchVm(query);
      const older = Search.methods.search.call(vm);
      await flush();
      const newer = Search.methods.search.call(vm);
      await flush();

      if (finish === 'resolve') old.resolve([[hit('old')]]);
      else old.reject(new Error('old failure'));
      await older;
      expect(vm.status).toBe('searching');
      expect(vm.events).toBeNull();
      expect(vm.error).toBe('');

      current.resolve([[hit('new')]]);
      await newer;
      expect(vm.events[0].data.title).toBe('new');
      expect(vm.status).toBeNull();
    }
  );

  test('late failures cannot erase a newer successful search', async () => {
    const old = deferred();
    const vm = searchVm(
      jest
        .fn()
        .mockReturnValueOnce(old.promise)
        .mockReturnValueOnce(old.promise)
        .mockResolvedValueOnce([[hit('new')]])
        .mockResolvedValueOnce([[browserEvent]])
    );
    const older = Search.methods.search.call(vm);
    await flush();
    await Search.methods.search.call(vm);
    old.reject(new Error('obsolete failure'));
    await older;
    expect(vm.events[0].data.title).toBe('new');
    expect(vm.browserEvents).toEqual([browserEvent]);
    expect(vm.error).toBe('');
    expect(vm.status).toBeNull();
  });

  test('captures both queries and dates before bucket discovery suspends', async () => {
    const loading = deferred();
    mockBuckets.ensureLoaded.mockReturnValueOnce(loading.promise);
    const query = jest.fn().mockResolvedValue([[]]);
    const vm = searchVm(query);
    const search = Search.methods.search.call(vm);
    vm.pattern = 'edited';
    Object.assign(vm.queryOptions, {
      hostname: 'edited-host',
      start: '2026-10-01',
      stop: '2026-10-31',
      filter_afk: false,
    });
    loading.resolve(undefined);
    await search;

    expect(mockBuckets.desktopBucketIds).toHaveBeenCalledWith('browser-only');
    expect(mockBuckets.bucketsBrowser).toHaveBeenCalledWith('browser-only');
    expect(query).toHaveBeenCalledTimes(2);
    for (const [periods, lines] of query.mock.calls) {
      expect(periods).toEqual([
        moment('2026-10-16').format() + '/' + moment('2026-10-17').format(),
      ]);
      expect(lines.join('\n')).toContain('example');
      expect(lines.join('\n')).not.toContain('edited');
    }
    expect(query.mock.calls[0][1].join('\n')).toContain('filter_period_intersect');
  });

  test('does not launch obsolete queries after delayed bucket discovery', async () => {
    const loading = deferred();
    mockBuckets.ensureLoaded.mockReturnValueOnce(loading.promise);
    const query = jest.fn().mockResolvedValue([[hit('new')]]);
    const vm = searchVm(query);
    const older = Search.methods.search.call(vm);
    vm.pattern = 'new';
    await Search.methods.search.call(vm);
    const latest = vm.events;
    loading.resolve(undefined);
    await older;
    expect(query).toHaveBeenCalledTimes(2);
    expect(vm.events).toBe(latest);
    expect(vm.status).toBeNull();
  });

  test('destruction invalidates a pending completion', async () => {
    mockBuckets.bucketsBrowser.mockReturnValue([]);
    const request = deferred();
    const vm = searchVm(jest.fn().mockReturnValue(request.promise));
    const search = Search.methods.search.call(vm);
    await flush();
    Search.beforeDestroy.call(vm);
    request.resolve([[hit('gone')]]);
    await search;
    expect(vm.events).toBeNull();
    expect(vm.browserEvents).toBeNull();
    expect(vm.error).toBe('');
    expect(vm.status).toBe('searching');
  });

  test('a current synchronous transport error survives an older failure', async () => {
    mockBuckets.bucketsBrowser.mockReturnValue([]);
    const vm = searchVm(jest.fn().mockResolvedValue([[hit('new')]]));
    const older = Search.methods.search.call(vm);
    await flush();

    const stale = deferred();
    vm.$aw.query = jest.fn().mockReturnValueOnce(stale.promise);
    const request = Search.methods.search.call(vm);
    await flush();
    vm.$aw.query = jest.fn(() => {
      throw new Error('current transport error');
    });
    await Search.methods.search.call(vm);
    stale.reject(new Error('stale failure'));
    await request;
    await older;
    expect(vm.error).toBe('Error: current transport error');
    expect(vm.status).toBeNull();
  });

  test('handles query construction failures as current errors and permits retry', async () => {
    mockBuckets.desktopBucketIds.mockImplementationOnce(() => {
      throw new Error('No host');
    });
    const vm = searchVm(jest.fn().mockResolvedValue([[]]));
    await expect(Search.methods.search.call(vm)).resolves.toBeUndefined();
    expect(vm.error).toContain('No host');
    expect(vm.status).toBeNull();
    await Search.methods.search.call(vm);
    expect(vm.error).toBe('');
  });

  test('mounted button and Enter submissions keep the newest result; add-week resubmits coherently', async () => {
    const localVue = createLocalVue();
    for (const name of ['shortdate', 'shorttime', 'friendlyduration'])
      localVue.filter(name, String);
    const old = deferred();
    mockBuckets.bucketsBrowser.mockReturnValue([]);
    const query = jest
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue([[hit('new')]]);
    const wrapper = shallowMount(SearchComponent, {
      localVue,
      mocks: { $aw: { query } },
      stubs: {
        'b-input': BFormInput,
        'b-button': BButton,
        'b-input-group': true,
        'b-input-group-append': true,
        'b-alert': true,
        'aw-query-options': true,
        'aw-selectable-eventview': {
          name: 'aw-selectable-eventview',
          props: ['events'],
          template: '<div />',
        },
        icon: true,
      },
      data: () => searchVm(query),
    });
    try {
      await wrapper.find('input').setValue('old');
      await wrapper.find('button').trigger('click');
      await flush();
      await wrapper.find('input').setValue('new');
      await wrapper.find('input').trigger('keyup.enter');
      await flush();
      old.resolve([[hit('old')]]);
      await flush();
      expect(
        wrapper.findComponent({ name: 'aw-selectable-eventview' }).props('events')[0].data.title
      ).toBe('new');
      expect((wrapper.vm as any).status).toBeNull();

      const buttons = wrapper.findAll('button');
      await buttons.at(buttons.length - 1).trigger('click');
      await flush();
      expect(query).toHaveBeenCalledTimes(3);
      expect((wrapper.vm as any).queryOptions.start).toBe('2026-10-09');
      expect(query.mock.calls[2][0]).toEqual([
        moment('2026-10-09').format() + '/' + moment('2026-10-17').format(),
      ]);
      expect(query.mock.calls[2][1].join('\n')).toContain('new');
    } finally {
      wrapper.destroy();
    }
  });

  test('keeps browser matches when the window query fails on a browser-only host', async () => {
    const query = jest
      .fn()
      .mockRejectedValueOnce({ response: { data: { message: 'Window bucket not found' } } })
      .mockResolvedValueOnce([[browserEvent, browserEvent]]);
    const vm = searchVm(query);

    await Search.methods.search.call(vm);

    expect(vm.browserEvents).toEqual([browserEvent]);
    expect(vm.events).toEqual([]);
    expect(vm.error).toContain('Window bucket not found');
    expect(vm.status).toBeNull();
  });

  test('keeps window matches and strips the synthetic category when the browser query fails', async () => {
    const vm = searchVm(
      jest
        .fn()
        .mockResolvedValueOnce([[windowEvent]])
        .mockRejectedValueOnce(new Error('Browser failed'))
    );

    await Search.methods.search.call(vm);

    expect(vm.events).toEqual([{ ...windowEvent, data: { app: 'Firefox', title: 'Example' } }]);
    expect(vm.browserEvents).toEqual([]);
    expect(vm.error).toContain('Browser failed');
    expect(vm.status).toBeNull();
  });

  test('clears previous matches and reports errors when both queries fail', async () => {
    const vm = searchVm(jest.fn().mockRejectedValue(new Error('Invalid regex')));
    vm.events = [windowEvent];
    vm.browserEvents = [browserEvent];

    await Search.methods.search.call(vm);

    expect(vm.events).toEqual([]);
    expect(vm.browserEvents).toEqual([]);
    expect(vm.error).toContain('Invalid regex');
    expect(vm.status).toBeNull();
  });

  test('skips the browser request when no browser buckets exist', async () => {
    mockBuckets.bucketsBrowser.mockReturnValue([]);
    const query = jest.fn().mockResolvedValue([[windowEvent]]);
    const vm = searchVm(query);

    await Search.methods.search.call(vm);

    expect(query).toHaveBeenCalledTimes(1);
    expect(vm.events).toHaveLength(1);
    expect(vm.browserEvents).toEqual([]);
    expect(vm.error).toBe('');
  });

  test('still searches windows when browser bucket discovery fails', async () => {
    mockBuckets.ensureLoaded.mockRejectedValueOnce(new Error('Bucket list unavailable'));
    const query = jest.fn().mockResolvedValue([[windowEvent]]);
    const vm = searchVm(query);

    await Search.methods.search.call(vm);

    expect(query).toHaveBeenCalledTimes(1);
    expect(vm.events).toHaveLength(1);
    expect(vm.browserEvents).toEqual([]);
    expect(vm.status).toBeNull();
  });
});
