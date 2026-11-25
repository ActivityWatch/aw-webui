import Vue from 'vue';
import { mount as fullMount, shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import WatcherLivenessBanner from '~/components/WatcherLivenessBanner.vue';
import { useBucketsStore } from '~/stores/buckets';
import { i18n, setAppLocale } from '~/i18n';

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
    await flush();
    expect(wrapper.vm.staleWatchers).toHaveLength(1);
  });

  test('waits for fresh metadata after a host change before judging buckets', async () => {
    store.buckets = [bucket('window-synced', 'currentwindow', 0), bucket('afk', 'afkstatus', 10)];
    wrapper = mount();
    await flush();
    expect(wrapper.vm.staleWatchers).toHaveLength(1);

    // A host switch must not reuse the previous host's clock: hold the refresh
    // pending and confirm the banner is suppressed until fresh metadata lands.
    let resolve;
    store.loadBuckets.mockClear();
    store.loadBuckets.mockImplementationOnce(
      () =>
        new Promise(done => {
          resolve = done;
        })
    );
    store.buckets = [
      bucket('other-window', 'currentwindow', 0, 'other'),
      bucket('other-afk', 'afkstatus', 10, 'other'),
    ];
    wrapper.setProps({ host: 'other' });
    await Vue.nextTick();
    expect(store.loadBuckets).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.metadataFresh).toBe(false);
    expect(wrapper.vm.staleWatchers).toEqual([]);
    resolve();
    await flush();
    expect(wrapper.vm.staleWatchers).toHaveLength(1);
  });

  test('keeps the minute unit for outages past 45 minutes', async () => {
    store.buckets = [bucket('window-synced', 'currentwindow', 0), bucket('afk', 'afkstatus', 46)];
    wrapper = mount();
    await flush();
    expect(wrapper.vm.staleWatchers).toEqual([
      { type: 'afk', name: 'aw-watcher-afk', minutesAgo: 46 },
    ]);
    // moment's default thresholds would say "an hour ago" from 45 minutes on.
    expect(wrapper.vm.reportedAgo(wrapper.vm.staleWatchers[0])).toBe('46 minutes ago');
  });

  test('renders the banner in the app locale, with its plural rules (#1324)', async () => {
    // The global $t stub is English-only; render through the real vue-i18n
    // instance, then restore the stub so later tests stay hermetic.
    const originalT = Vue.prototype.$t;
    Vue.prototype.$t = function (key, values) {
      return this.$i18n.t(key, values);
    };
    store.buckets = [bucket('window-synced', 'currentwindow', 0), bucket('afk', 'afkstatus', 6)];
    const render = async () => {
      wrapper = fullMount(WatcherLivenessBanner, {
        propsData: { host: 'desktop' },
        i18n,
        stubs: { 'b-alert': { template: '<div><slot /></div>' } },
      });
      await flush();
      const text = wrapper.text().replace(/\s+/g, ' ');
      wrapper.destroy();
      wrapper = undefined;
      return text;
    };
    try {
      setAppLocale('de');
      const de = await render();
      expect(de).toContain('Watcher gestoppt:');
      expect(de).toContain('aw-watcher-afk hat sich zuletzt vor 6 Minuten gemeldet.');
      expect(de).toContain('Prüfen Sie das Tray-Symbol oder starten Sie den Watcher neu.');
      setAppLocale('ru');
      expect(await render()).toContain('6 минут назад');
      setAppLocale('en');
      const en = await render();
      expect(en).toBe(
        'Watcher stopped: aw-watcher-afk last reported 6 minutes ago. ' +
          'Check the tray icon or restart the watcher.'
      );
    } finally {
      setAppLocale('en');
      Vue.prototype.$t = originalT;
    }
  });
});
