import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { createClient, getClient } from '~/util/awclient';

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

  test('legacy localStorage fallback restores an array rather than its JSON string', async () => {
    jest.spyOn(getClient(), 'get_settings').mockResolvedValue({});
    localStorage.setItem('multideviceHostOrder', JSON.stringify(['laptop', 'desktop']));
    const store = useSettingsStore();
    await store.load();
    expect(store.multideviceHostOrder).toEqual(['laptop', 'desktop']);
  });
});
