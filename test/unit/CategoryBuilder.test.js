import { createLocalVue, mount, shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { PiniaVuePlugin } from 'pinia';
import CategoryBuilder from '~/views/settings/CategoryBuilder.vue';
import QueryOptions from '~/components/QueryOptions.vue';
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
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
