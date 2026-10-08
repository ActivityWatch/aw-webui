import Vue from 'vue';
import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import WatcherLivenessBanner from '~/components/WatcherLivenessBanner.vue';
import { useBucketsStore } from '~/stores/buckets';

const NOW = Date.parse('2026-10-08T12:00:00Z');
const bucket = (id, type, age, hostname = 'desktop') => ({
  id,
  type,
  hostname,
  last_updated: new Date(Date.now() - age * 60000).toISOString(),
});
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Vue.nextTick();
};

describe('watcher liveness banner', () => {
  let store;
  let wrapper;
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(NOW);
    sessionStorage.clear();
    createTestingPinia();
    store = useBucketsStore();
    store.buckets = [bucket('window-synced', 'currentwindow', 0), bucket('afk', 'afkstatus', 0)];
  });
  afterEach(() => {
    if (wrapper) wrapper.destroy();
    jest.useRealTimers();
  });
  const mount = (host = 'desktop') =>
    shallowMount(WatcherLivenessBanner, { propsData: { host }, stubs: ['b-alert'] });

  test('does not overlap slow requests and hides warnings after a failed refresh', async () => {
    let resolve;
    store.loadBuckets.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    store.buckets = [bucket('window-synced', 'currentwindow', 0), bucket('afk', 'afkstatus', 10)];
    wrapper = mount();
    jest.advanceTimersByTime(60000);
    expect(store.loadBuckets).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.staleWatchers).toEqual([]);
    resolve();
    await flush();
    expect(wrapper.vm.staleWatchers).toHaveLength(1);
    store.loadBuckets.mockRejectedValueOnce(new Error('offline'));
    jest.advanceTimersByTime(60000);
    await flush();
    expect(wrapper.vm.staleWatchers).toEqual([]);
  });

  test('polls fresh metadata, detects a stopped watcher, and clears on recovery', async () => {
    store.loadBuckets.mockImplementation(async () => {
      store.buckets = [
        bucket('window-synced', 'currentwindow', 0),
        { ...bucket('afk', 'afkstatus', 0), last_updated: new Date(NOW).toISOString() },
      ];
    });
    wrapper = mount();
    await flush();
    expect(wrapper.vm.staleWatchers).toEqual([]);
    for (let minute = 0; minute < 6; minute++) {
      jest.advanceTimersByTime(60000);
      await flush();
    }
    expect(store.loadBuckets).toHaveBeenCalledTimes(7);
    expect(wrapper.vm.staleWatchers).toEqual([
      { type: 'afk', name: 'aw-watcher-afk', minutesAgo: 6 },
    ]);
    store.loadBuckets.mockImplementation(async () => {
      store.buckets = [bucket('window-synced', 'currentwindow', 0), bucket('afk', 'afkstatus', 0)];
    });
    jest.advanceTimersByTime(60000);
    await flush();
    expect(wrapper.vm.staleWatchers).toEqual([]);
    wrapper.destroy();
    const calls = store.loadBuckets.mock.calls.length;
    jest.advanceTimersByTime(60000);
    await flush();
    expect(store.loadBuckets).toHaveBeenCalledTimes(calls);
  });

  test('suppresses warnings when both watchers are stale or the host has no buckets', async () => {
    store.buckets = [bucket('window-synced', 'currentwindow', 10), bucket('afk', 'afkstatus', 10)];
    wrapper = mount();
    await flush();
    expect(wrapper.vm.staleWatchers).toEqual([]);
    await wrapper.setProps({ host: 'other' });
    expect(wrapper.vm.staleWatchers).toEqual([]);
  });

  test('dismissal survives navigation but is scoped to the selected host', async () => {
    store.buckets = [bucket('window-synced', 'currentwindow', 0), bucket('afk', 'afkstatus', 10)];
    wrapper = mount();
    await flush();
    expect(wrapper.vm.staleWatchers).toHaveLength(1);
    wrapper.vm.dismiss('afk');
    await Vue.nextTick();
    expect(wrapper.vm.staleWatchers).toEqual([]);
    wrapper.destroy();
    wrapper = mount();
    await flush();
    expect(wrapper.vm.staleWatchers).toEqual([]);
    store.buckets = [
      bucket('other-window', 'currentwindow', 0, 'other'),
      bucket('other-afk', 'afkstatus', 10, 'other'),
    ];
    await wrapper.setProps({ host: 'other' });
    expect(wrapper.vm.staleWatchers).toHaveLength(1);
  });
});
