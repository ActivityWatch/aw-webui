import { setActivePinia, createPinia } from 'pinia';

import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { createClient } from '~/util/awclient';

const bucket = (id: string, type: string, hostname: string) => ({
  id,
  type,
  hostname,
  client: 'test',
  created: '2026-01-01T00:00:00Z',
  last_updated: '2026-01-01T00:00:00Z',
  data: {},
});

describe('activity store host selection', () => {
  setActivePinia(createPinia());
  createClient();

  const activityStore = useActivityStore();
  const bucketsStore = useBucketsStore();
  bucketsStore.buckets = [
    bucket('aw-watcher-window_self', 'currentwindow', 'self'),
    bucket('aw-watcher-afk_self', 'afkstatus', 'self'),
    bucket('aw-watcher-window_laptop-synced-from-laptop', 'currentwindow', 'laptop'),
    bucket('aw-watcher-afk_laptop-synced-from-laptop', 'afkstatus', 'laptop'),
    bucket('aw-watcher-android-test-synced-from-phone', 'currentwindow', 'phone'),
    bucket('aw-watcher-window_fakedata', 'currentwindow', 'fakedata'),
    bucket('aw-watcher-afk_fakedata', 'afkstatus', 'fakedata'),
  ] as any;

  test('a single host is not a multidevice selection', () => {
    expect(activityStore.resolve_multidevice_hosts('self')).toEqual([]);
  });

  test('@all resolves to every real host with data, including synced and mobile ones', () => {
    const hosts = activityStore.resolve_multidevice_hosts('@all');
    expect(hosts.sort()).toEqual(['laptop', 'phone', 'self']);
  });

  test('an explicit list is resolved against the available hosts', () => {
    expect(activityStore.resolve_multidevice_hosts('phone,nonexistent,laptop').sort()).toEqual([
      'laptop',
      'phone',
    ]);
  });

  test('fakedata hosts are only included when explicitly selected', () => {
    expect(activityStore.resolve_multidevice_hosts('fakedata,self').sort()).toEqual([
      'fakedata',
      'self',
    ]);
  });

  test('multidevice params use the actual (synced) bucket ids', () => {
    const params = activityStore.multidevice_params(
      { host: '@all', filter_afk: true, filter_categories: [], always_active_pattern: '' },
      ['laptop', 'phone']
    );
    expect(params.hosts).toEqual(['laptop', 'phone']);
    expect(params.host_params.laptop).toEqual({
      bid_window: 'aw-watcher-window_laptop-synced-from-laptop',
      bid_afk: 'aw-watcher-afk_laptop-synced-from-laptop',
    });
    expect(params.host_params.phone).toEqual({
      bid_android: 'aw-watcher-android-test-synced-from-phone',
      isIos: false,
    });
  });
});

describe('activity store history cache', () => {
  setActivePinia(createPinia());
  const activityStore = useActivityStore();

  test('is kept while the queried devices and buckets are the same', () => {
    activityStore.query_hosts = ['a', 'b'];
    activityStore.buckets.afk = ['afk_a', 'afk_b'];
    activityStore.buckets.android = [];
    activityStore.set_history_key();
    activityStore.active.history = { p: [] } as any;
    activityStore.set_history_key();
    expect(activityStore.active.history).toEqual({ p: [] });
  });

  test('is cleared when a new device shows up under the same selection', () => {
    activityStore.active.history = { p: [] } as any;
    activityStore.query_hosts = ['a', 'b', 'phone'];
    activityStore.buckets.android = ['aw-watcher-android-test-synced-from-phone'];
    activityStore.set_history_key();
    expect(activityStore.active.history).toEqual({});
  });
});
