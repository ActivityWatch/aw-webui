import { setActivePinia, createPinia } from 'pinia';

import { useSettingsStore } from '~/stores/settings';
import { createClient, getClient } from '~/util/awclient';

describe('settings store', () => {
  setActivePinia(createPinia());
  const settingsStore = useSettingsStore();

  beforeEach(() => {
    settingsStore.$reset();
    jest.restoreAllMocks();
  });

  test('ensureLoaded coalesces concurrent loads', async () => {
    let resolveLoad!: () => void;
    const loadMock = jest.spyOn(settingsStore, 'load').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveLoad = () => {
            settingsStore.$patch({ _loaded: true });
            resolve();
          };
        })
    );

    const firstLoad = settingsStore.ensureLoaded();
    const secondLoad = settingsStore.ensureLoaded();

    expect(loadMock).toHaveBeenCalledTimes(1);

    resolveLoad();
    await Promise.all([firstLoad, secondLoad]);

    expect(settingsStore.loaded).toBe(true);
  });

  test('category builder ignored words default to empty and persist via update', async () => {
    expect(settingsStore.category_builder_ignored_words).toEqual([]);
    const save = jest.spyOn(settingsStore, 'save').mockResolvedValue();
    jest.spyOn(settingsStore, 'ensureLoaded').mockResolvedValue();

    await settingsStore.update({ category_builder_ignored_words: ['github'] });

    expect(save).toHaveBeenCalledTimes(1);
    expect(settingsStore.category_builder_ignored_words).toEqual(['github']);
  });

  test('update waits for settings to load before patching state', async () => {
    const savedQueries = [
      {
        id: 'daily-coding-time',
        name: 'Daily Coding Time',
        query_code: 'RETURN = [];',
        start_day_offset: 0,
        end_day_offset: -1,
        event_type: 'currentwindow',
      },
    ];
    const steps: string[] = [];

    jest.spyOn(settingsStore, 'ensureLoaded').mockImplementation(async () => {
      steps.push('ensureLoaded');
      expect(settingsStore.saved_queries).toEqual([]);
      settingsStore.$patch({ _loaded: true });
    });

    jest.spyOn(settingsStore, 'save').mockImplementation(async () => {
      steps.push('save');
      expect(settingsStore.saved_queries).toEqual(savedQueries);
    });

    await settingsStore.update({ saved_queries: savedQueries });

    expect(steps).toEqual(['ensureLoaded', 'save']);
    expect(settingsStore.saved_queries).toEqual(savedQueries);
  });

  describe('saving alert goals', () => {
    beforeAll(() => {
      createClient();
      // save() always mirrors the theme and landing page to localStorage.
      (global as any).localStorage = { setItem: jest.fn() };
    });
    afterAll(() => {
      delete (global as any).localStorage;
    });

    function fakeServer() {
      const post = jest.fn().mockResolvedValue({});
      jest
        .spyOn(getClient(), 'get_settings')
        .mockResolvedValue({ theme: 'light' } as Record<string, unknown>);
      (getClient() as any).req = { post, defaults: {} };
      // save() reloads afterwards; the server then has every posted key.
      jest.spyOn(settingsStore, 'load').mockImplementation(async () => {
        const posted = post.mock.calls.map(([url]) => url.split('/').pop());
        settingsStore.$patch({
          _storedKeys: [...new Set([...settingsStore._storedKeys, ...posted])],
        });
      });
      settingsStore.$patch({ _loaded: true, _storedKeys: ['theme'] });
      return post;
    }
    const postedKeys = (post: jest.Mock) => post.mock.calls.map(([url]) => url);

    test('an unrelated save leaves never-saved alerts unsaved', async () => {
      const post = fakeServer();
      settingsStore.$patch({ theme: 'dark' });
      await settingsStore.save();
      expect(postedKeys(post)).toContain('/0/settings/theme');
      expect(postedKeys(post)).not.toContain('/0/settings/alerts');
    });

    test('an explicit update saves alerts, even when emptied', async () => {
      const post = fakeServer();
      await settingsStore.update({ alerts: [] });
      expect(post).toHaveBeenCalledWith('/0/settings/alerts', [], expect.anything());
      expect(settingsStore.hasStoredAlerts).toBe(true);
    });

    test('a failed update does not mark alerts as stored', async () => {
      const post = fakeServer();
      post.mockRejectedValueOnce(new Error('offline'));
      await expect(settingsStore.update({ alerts: [] })).rejects.toThrow('offline');
      expect(settingsStore.hasStoredAlerts).toBe(false);
    });

    test('an older failing update cannot unmark alerts saved meanwhile', async () => {
      const post = fakeServer();
      let failOld!: (e: Error) => void;
      post.mockImplementation(async url => {
        if (url === '/0/settings/theme') {
          await new Promise((_resolve, reject) => {
            failOld = reject;
          });
        }
        return {};
      });
      settingsStore.$patch({ theme: 'dark' });
      const older = settingsStore.update({ theme: 'dark' });
      await new Promise(resolve => setTimeout(resolve, 0));
      settingsStore.$patch({ theme: 'light' });
      post.mockResolvedValue({});
      await settingsStore.update({ alerts: [] });
      failOld(new Error('offline'));
      await expect(older).rejects.toThrow('offline');
      expect(settingsStore.hasStoredAlerts).toBe(true);
    });
  });
});
