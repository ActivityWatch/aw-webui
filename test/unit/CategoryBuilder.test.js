import { createLocalVue, mount, shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { PiniaVuePlugin, setActivePinia, createPinia } from 'pinia';
import CategoryBuilder from '~/views/settings/CategoryBuilder.vue';
import QueryOptions from '~/components/QueryOptions.vue';
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { getClient } from '~/util/awclient';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);
localVue.component('aw-query-options', QueryOptions);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const androidBucket = {
  id: 'aw-watcher-android-legacy',
  hostname: 'unknown',
  type: 'currentwindow',
  data: {},
};
const events = app => [[{ data: { app }, duration: 120 }]];
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const translate = key =>
  ({
    'ui.categoryBuilder.retry': 'Retry',
    'ui.categoryBuilder.noHost': 'No host with activity buckets is available.',
    'ui.categoryBuilder.selectHost': 'Select a hostname under Show options',
    'ui.categoryBuilder.noActivity': 'No activity data is available for this host.',
    'common.loading': 'Loading...',
  })[key] || key;

describe('CategoryBuilder loading', () => {
  let wrapper, pinia, buckets, categories, query;

  beforeEach(() => {
    pinia = createTestingPinia({ createSpy: jest.fn });
    buckets = useBucketsStore();
    buckets.buckets = [androidBucket];
    categories = useCategoryStore();
    query = jest.fn().mockResolvedValue(events('Firefox'));
    getClient.mockReturnValue({ query });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    wrapper?.destroy();
    jest.restoreAllMocks();
  });

  function mountBuilder(realOptions = false) {
    wrapper = (realOptions ? mount : shallowMount)(CategoryBuilder, {
      localVue,
      pinia,
      stubs: {
        'aw-query-options': !realOptions,
        'b-button': true,
        'b-spinner': true,
        'b-modal': true,
        'b-form': true,
        'b-form-group': true,
        'b-form-select': true,
        'b-form-select-option': true,
        'b-form-input': true,
        'b-form-checkbox': true,
      },
      mocks: { $t: translate },
    });
    return wrapper;
  }

  test('loads an Android-only unknown host without opening options or querying AFK', async () => {
    mountBuilder();
    await flush();
    expect(wrapper.vm.queryOptions.hostname).toBe('unknown');
    expect(query).toHaveBeenCalledTimes(1);
    const code = query.mock.calls[0][1].join('\n');
    expect(code).toContain(androidBucket.id);
    expect(code).not.toContain('aw-watcher-afk');
    expect(wrapper.text()).toContain('Firefox');
    expect(wrapper.text()).not.toContain('Loading...');
  });

  test.each(['buckets', 'categories', 'query'])(
    'recovers from a %s failure using Retry',
    async stage => {
      // A known host also exercises failures independently of unknown-host selection.
      buckets.buckets = [{ ...androidBucket, hostname: 'phone' }];
      const action = { buckets: buckets.ensureLoaded, categories: categories.load, query }[stage];
      action.mockRejectedValueOnce(new Error('Server unavailable'));
      mountBuilder();
      await flush();
      expect(wrapper.text()).not.toContain('Loading...');
      expect(wrapper.find('[role="alert"]').text()).toContain('Could not load');
      const retry = wrapper.findAll('b-button-stub').wrappers.find(w => w.text() === 'Retry');
      await retry.vm.$emit('click');
      await flush();
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.text()).toContain('Firefox');
    }
  );

  test('stops loading when there are no buckets', async () => {
    buckets.buckets = [];
    mountBuilder();
    await flush();
    expect(query).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No host');
    expect(wrapper.text()).not.toContain('Loading...');
  });

  test('waits for a choice when multiple known hosts exist', async () => {
    buckets.buckets = ['phone', 'tablet'].map(hostname => ({ ...androidBucket, hostname }));
    mountBuilder();
    await flush();
    expect(query).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Select a hostname');
    expect(wrapper.text()).not.toContain('Loading...');
  });

  test('does not query nonexistent desktop buckets for an unsupported host', async () => {
    buckets.buckets = [{ ...androidBucket, id: 'browser-only', type: 'web.tab.current' }];
    mountBuilder();
    await flush();
    expect(query).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('No activity data is available for this host.');
    expect(wrapper.text()).not.toContain('Loading...');
  });

  test('uses the actual desktop bucket IDs and enables AFK filtering by default', async () => {
    buckets.buckets = [
      { ...androidBucket, id: 'custom-window', hostname: 'desktop' },
      { ...androidBucket, id: 'custom-afk', hostname: 'desktop', type: 'afkstatus' },
    ];
    mountBuilder();
    await flush();
    const code = query.mock.calls[0][1].join('\n');
    expect(code).toContain('custom-window');
    expect(code).toContain('custom-afk');
    expect(code).toContain('filter_period_intersect');
    expect(wrapper.text()).toContain('Firefox');
  });

  test('prefers ScreenTime and preserves its title merge key', async () => {
    buckets.buckets.push({ ...androidBucket, id: 'aw-import-screentime-phone', type: 'app' });
    mountBuilder();
    await flush();
    const code = query.mock.calls[0][1].join('\n');
    expect(code).toContain('aw-import-screentime-phone');
    expect(code).not.toContain(androidBucket.id);
    expect(code).toContain('merge_events_by_keys(events, ["app", "title"])');
  });

  test('preserves the chosen host and dates when reopening options', async () => {
    buckets.buckets = ['phone', 'tablet'].map(hostname => ({ ...androidBucket, hostname }));
    mountBuilder(true);
    await flush();
    await wrapper.setData({
      queryOptions: {
        hostname: 'tablet',
        start: '2026-01-01',
        stop: '2026-01-02',
        filter_afk: false,
      },
    });
    await flush();
    const chosen = { ...wrapper.vm.queryOptions };
    for (let i = 0; i < 2; i++) {
      await wrapper.setData({ show_options: true });
      await flush();
      expect(wrapper.findComponent(QueryOptions).vm.queryOptionsData).toEqual(chosen);
      expect(wrapper.vm.queryOptions).toEqual(chosen);
      await wrapper.setData({ show_options: false });
    }
  });

  test('an old completion cannot hide the spinner for a newer pending query', async () => {
    const old = deferred();
    const current = deferred();
    query.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    mountBuilder();
    await flush();
    wrapper.vm.queryOptions.start = '2026-01-01';
    await flush();
    old.resolve(events('StaleApp'));
    await flush();
    expect(wrapper.text()).toContain('Loading...');
    current.resolve(events('Firefox'));
    await flush();
    expect(wrapper.text()).toContain('Firefox');
    expect(wrapper.text()).not.toContain('Loading...');
  });

  test.each(['resolve', 'reject'])('ignores an old query that later %ss', async completion => {
    buckets.buckets = [{ ...androidBucket, hostname: 'phone' }];
    const old = deferred();
    query.mockReturnValueOnce(old.promise);
    mountBuilder();
    await flush();
    wrapper.vm.queryOptions.start = '2026-01-01';
    await flush();
    expect(wrapper.text()).toContain('Firefox');
    if (completion === 'resolve') old.resolve(events('StaleApp'));
    else old.reject(new Error('Old query failed'));
    await flush();
    expect(wrapper.text()).toContain('Firefox');
    expect(wrapper.text()).not.toContain('StaleApp');
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});

// "Ignore" used to only push to component state, so ignored words came back on
// reload. They now persist via the settings store.
// See https://github.com/ActivityWatch/aw-webui/issues/486
describe('CategoryBuilder ignored words', () => {
  function ctx(ignored = []) {
    const settingsStore = {
      category_builder_ignored_words: ignored,
      // $patch mirrors pinia's synchronous patch — update properties in place.
      $patch: jest.fn(state => Object.assign(settingsStore, state)),
      update: jest.fn(async state => Object.assign(settingsStore, state)),
    };
    const vm = { settingsStore, show_ignored: true, fetchWords: jest.fn() };
    vm.persistIgnoredWords = next => CategoryBuilder.methods.persistIgnoredWords.call(vm, next);
    // The component reads ignored_words through this computed.
    Object.defineProperty(vm, 'ignored_words', {
      get: () => CategoryBuilder.computed.ignored_words.call(vm),
    });
    return vm;
  }
  const call = (name, vm, ...args) => CategoryBuilder.methods[name].call(vm, ...args);

  test('ignoreWord persists the word to settings', async () => {
    const vm = ctx(['foo']);
    await call('ignoreWord', vm, 'bar');
    expect(vm.settingsStore.update).toHaveBeenCalledWith({
      category_builder_ignored_words: ['foo', 'bar'],
    });
    expect(vm.ignored_words).toEqual(['foo', 'bar']);
  });

  test('ignoreWord does not duplicate an already-ignored word', async () => {
    const vm = ctx(['foo']);
    await call('ignoreWord', vm, 'foo');
    expect(vm.settingsStore.update).not.toHaveBeenCalled();
  });

  test('unignoreWord removes the word and refetches so it can reappear', async () => {
    const vm = ctx(['foo', 'bar']);
    await call('unignoreWord', vm, 'foo');
    expect(vm.settingsStore.update).toHaveBeenCalledWith({
      category_builder_ignored_words: ['bar'],
    });
    expect(vm.fetchWords).toHaveBeenCalled();
  });

  test('resetIgnoredWords clears the list and refetches', async () => {
    const vm = ctx(['foo', 'bar']);
    await call('resetIgnoredWords', vm);
    expect(vm.settingsStore.update).toHaveBeenCalledWith({ category_builder_ignored_words: [] });
    expect(vm.show_ignored).toBe(false);
    expect(vm.fetchWords).toHaveBeenCalled();
  });

  test('missing setting reads as no ignored words', () => {
    const vm = ctx(undefined);
    expect(vm.ignored_words).toEqual([]);
  });

  test('ignoreWord patches store synchronously so overlapping calls read the updated list', async () => {
    // Simulate two rapid Ignore clicks before either async update resolves.
    // The second call must see the first word in the list, not the stale snapshot.
    const vm = ctx([]);
    // Fire both ignores without awaiting the first one
    const p1 = call('ignoreWord', vm, 'foo');
    const p2 = call('ignoreWord', vm, 'bar');
    await Promise.all([p1, p2]);
    // Both words must end up in the final list — neither should be lost.
    expect(vm.ignored_words).toEqual(expect.arrayContaining(['foo', 'bar']));
    expect(vm.ignored_words).toHaveLength(2);
  });

  test('ignoreWord calls $patch synchronously before the async update', async () => {
    const vm = ctx(['existing']);
    await call('ignoreWord', vm, 'new');
    // $patch must have been called (synchronous guard against read-modify-write race)
    expect(vm.settingsStore.$patch).toHaveBeenCalledWith({
      category_builder_ignored_words: ['existing', 'new'],
    });
  });
});

// The mocked-store tests above cannot see save()'s trailing load(), which patches
// server state back over local state. This runs the real settings store against a
// slow fake server to check overlapping clicks still converge on every word.
describe('CategoryBuilder ignored words with the real settings store', () => {
  const KEY = 'category_builder_ignored_words';
  const STEP = 20;
  const delay = () => new Promise(resolve => setTimeout(resolve, STEP));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  function setup(initial = []) {
    setActivePinia(createPinia());
    // Seed the server with every default so a save only has to post KEY.
    const defaults = JSON.parse(JSON.stringify(useSettingsStore().$state));
    Object.keys(defaults).forEach(k => k.startsWith('_') && delete defaults[k]);
    const server = { ...defaults, [KEY]: initial };
    getClient.mockReturnValue({
      req: {
        defaults: {},
        post: jest.fn(async (url, value) => {
          await delay();
          server[url.split('/').pop()] = JSON.parse(JSON.stringify(value));
        }),
      },
      get_settings: jest.fn(async () => {
        await delay();
        return JSON.parse(JSON.stringify(server));
      }),
    });
    const settingsStore = useSettingsStore();
    settingsStore.$patch({ _loaded: true });
    const vm = { settingsStore, show_ignored: true, fetchWords: jest.fn() };
    vm.persistIgnoredWords = next => CategoryBuilder.methods.persistIgnoredWords.call(vm, next);
    Object.defineProperty(vm, 'ignored_words', {
      get: () => CategoryBuilder.computed.ignored_words.call(vm),
    });
    return { vm, server, settingsStore };
  }
  const call = (name, vm, ...args) => CategoryBuilder.methods[name].call(vm, ...args);

  test('overlapping ignores persist every word', async () => {
    const { vm, server, settingsStore } = setup();
    // The first save is mid-flight (3 server round trips of STEP each) when the
    // second click lands, just before its trailing load() patches stale state back.
    const first = call('ignoreWord', vm, 'foo');
    await wait(STEP * 2.5);
    const second = call('ignoreWord', vm, 'bar');
    await Promise.all([first, second]);
    expect(server[KEY]).toEqual(['foo', 'bar']);
    expect(settingsStore[KEY]).toEqual(['foo', 'bar']);
  });

  test('overlapping unignores persist every removal', async () => {
    const { vm, server, settingsStore } = setup(['foo', 'bar', 'baz']);
    await settingsStore.load();
    const first = call('unignoreWord', vm, 'foo');
    await wait(STEP * 2.5);
    const second = call('unignoreWord', vm, 'bar');
    await Promise.all([first, second]);
    expect(server[KEY]).toEqual(['baz']);
    expect(settingsStore[KEY]).toEqual(['baz']);
  });

  test('a failed save does not block later saves', async () => {
    const { vm, server } = setup();
    const client = getClient();
    client.req.post.mockRejectedValueOnce(new Error('offline'));
    await expect(call('ignoreWord', vm, 'foo')).rejects.toThrow('offline');
    await call('ignoreWord', vm, 'bar');
    expect(server[KEY]).toEqual(expect.arrayContaining(['bar']));
  });
});
