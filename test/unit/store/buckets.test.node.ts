import { setActivePinia, createPinia } from 'pinia';

import { useBucketsStore } from '~/stores/buckets';
import { useServerStore } from '~/stores/server';
import { IBucket } from '~/util/interfaces';

function bucket(partial: Partial<IBucket> & { id: string }): IBucket {
  return {
    hostname: 'erb-m2',
    type: 'currentwindow',
    data: {},
    last_updated: new Date('2026-09-16T00:00:00Z'),
    first_seen: new Date('2026-09-16T00:00:00Z'),
    ...partial,
  } as IBucket;
}

describe('bucketsByDevice', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    useServerStore().$patch({
      info: {
        hostname: 'erb-m2',
        device_id: 'local-uuid',
        version: '0.14.0',
        testing: true,
      },
    });
  });

  test('falls back to hostname when data.device_id is missing', () => {
    const store = useBucketsStore();
    store.update_buckets([bucket({ id: 'aw-watcher-window_erb-m2' })]);

    const device = Object.values(store.bucketsByDevice)[0];
    expect(device.hostname).toBe('erb-m2');
    expect(device.device_id).toBe('erb-m2');
    expect(device.device_ids).toEqual(['erb-m2']);
    expect((device as { id?: string }).id).toBeUndefined();
  });

  test('exposes data.device_id when it differs from hostname', () => {
    const store = useBucketsStore();
    store.update_buckets([
      bucket({
        id: 'aw-watcher-window_erb-m2',
        data: { device_id: 'dev-uuid-1' },
      }),
    ]);

    const device = Object.values(store.bucketsByDevice)[0];
    expect(device.hostname).toBe('erb-m2');
    expect(device.device_id).toBe('dev-uuid-1');
    expect(device.hostname !== device.device_id).toBe(true);
    expect((device as { id?: string }).id).toBeUndefined();
  });

  test('collects several device_ids on the same host', () => {
    const store = useBucketsStore();
    store.update_buckets([
      bucket({
        id: 'aw-watcher-window_erb-m2',
        data: { device_id: 'uuid-a' },
      }),
      bucket({
        id: 'aw-watcher-afk_erb-m2',
        type: 'afkstatus',
        data: { device_id: 'uuid-b' },
      }),
    ]);

    const device = Object.values(store.bucketsByDevice)[0];
    expect(device.device_ids).toEqual(expect.arrayContaining(['uuid-a', 'uuid-b']));
    expect(device.device_ids).toHaveLength(2);
  });
});
