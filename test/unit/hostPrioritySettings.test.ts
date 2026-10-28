import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { createClient, getClient } from '~/util/awclient';
import ActivityComponent from '~/views/activity/Activity.vue';

const Activity: any = ActivityComponent;

describe('overlap priority settings persistence', () => {
  beforeAll(() => createClient());
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });
  afterEach(() => jest.restoreAllMocks());

  test('saves the host order to the backend and restores it in a fresh store', async () => {
    const server: Record<string, unknown> = {};
    const client = getClient();
    jest.spyOn(client, 'get_settings').mockImplementation(async () => ({ ...server }));
    const post = jest.spyOn(client.req, 'post').mockImplementation(async (url, value) => {
      server[String(url).split('/').pop() || ''] = value;
      return {} as any;
    });
    const store = useSettingsStore();
    expect(store.multideviceHostOrder).toEqual([]);
    await store.update({ multideviceHostOrder: ['phone', 'desktop'] });
    expect(post).toHaveBeenCalledWith(
      '/0/settings/multideviceHostOrder',
      ['phone', 'desktop'],
      expect.anything()
    );
    setActivePinia(createPinia());
    const reloaded = useSettingsStore();
    await reloaded.load();
    expect(reloaded.multideviceHostOrder).toEqual(['phone', 'desktop']);
  });

  test.each([false, true])(
    'leaving during a save reloads actual persisted priority on next use (accepted=%s)',
    async accepted => {
      const previous = ['desktop', 'phone'];
      const next = ['phone', 'desktop'];
      const server = { multideviceHostOrder: previous };
      const client = getClient();
      const get = jest
        .spyOn(client, 'get_settings')
        .mockImplementation(async () => ({ ...server }));
      const store = useSettingsStore();
      await store.ensureLoaded();
      const pendingGet = get.mock.calls.length + (accepted ? 2 : 1);
      let rejectGet!: (error: Error) => void;
      get.mockImplementation(() => {
        if (get.mock.calls.length === pendingGet) {
          return new Promise((_resolve, reject) => (rejectGet = reject));
        }
        return Promise.resolve({ ...server });
      });
      const post = jest.spyOn(client.req, 'post').mockImplementation(async (url, value) => {
        if (String(url).endsWith('/multideviceHostOrder')) server.multideviceHostOrder = value;
        return {} as any;
      });
      const vm: any = {
        settingsStore: store,
        selectableHosts: previous,
        isMultidevice: true,
        prioritySaving: false,
        priorityRefreshPending: false,
        priorityRefreshForce: false,
        refresh: jest.fn(),
        activityStore: {
          reset: jest.fn(async () => rejectGet(new Error('canceled'))),
        },
      };
      const saving = Activity.methods.moveHost.call(vm, 'phone', -1);
      // Wait until either the pre-POST or final reload GET is in flight.
      for (let i = 0; i < 100 && !rejectGet; i++) await Promise.resolve();
      expect(rejectGet).toBeDefined();
      expect(store.multideviceHostOrder).toEqual(next);
      await Activity.beforeDestroy.call(vm);
      await saving;
      expect(store.multideviceHostOrder).toEqual(previous);
      expect(store.loaded).toBe(false);
      const callsBeforeReload = get.mock.calls.length;
      await store.ensureLoaded();
      expect(get).toHaveBeenCalledTimes(callsBeforeReload + 1);
      expect(store.multideviceHostOrder).toEqual(accepted ? next : previous);
      expect(vm.refresh).not.toHaveBeenCalled();
      expect(post.mock.calls.some(([url]) => String(url).endsWith('/multideviceHostOrder'))).toBe(
        accepted
      );
    }
  );

  test('legacy localStorage fallback restores an array rather than its JSON string', async () => {
    jest.spyOn(getClient(), 'get_settings').mockResolvedValue({});
    localStorage.setItem('multideviceHostOrder', JSON.stringify(['laptop', 'desktop']));
    const store = useSettingsStore();
    await store.load();
    expect(store.multideviceHostOrder).toEqual(['laptop', 'desktop']);
  });
});
