import Search from '~/views/Search.vue';

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

describe('Search query failure isolation', () => {
  beforeEach(() => {
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
