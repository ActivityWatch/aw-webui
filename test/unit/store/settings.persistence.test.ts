import { createPinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { i18n } from '~/i18n';

const mockGetSettings = jest.fn();
const mockPost = jest.fn();
const mockDefaults = { timeout: 0 };

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    get_settings: mockGetSettings,
    req: { post: mockPost, defaults: mockDefaults },
  }),
}));

// Model the JSON transport boundary: stores must not share object references
// with each other or with the server.
const jsonCopy = value => JSON.parse(JSON.stringify(value));

describe('settings persistence scope', () => {
  let server: Record<string, any>;
  const newSession = () => useSettingsStore(createPinia());
  const postedKeys = () => mockPost.mock.calls.map(([url]) => url.replace('/0/settings/', ''));

  beforeEach(() => {
    server = { theme: 'auto', startOfWeek: 'Monday', futureSetting: { enabled: true } };
    localStorage.clear();
    i18n.locale = 'en';
    mockDefaults.timeout = 0;
    mockGetSettings.mockReset().mockImplementation(async () => jsonCopy(server));
    mockPost.mockReset().mockImplementation(async (url, value) => {
      server[url.replace('/0/settings/', '')] = jsonCopy(value);
      return {};
    });
  });

  test('a stale session writes only its intended key and reloads confirmed unrelated settings', async () => {
    const a = newSession();
    const b = newSession();
    await a.load();
    await b.load();

    await a.update({ theme: 'dark' });
    expect(b.theme).toBe('auto');
    server.futureSetting.enabled = false;
    expect(b.$state['futureSetting']).toEqual({ enabled: true });
    mockPost.mockClear();
    await b.update({ startOfWeek: 'Sunday' });

    expect(postedKeys()).toEqual(['startOfWeek']);
    expect(server).toEqual({
      theme: 'dark',
      startOfWeek: 'Sunday',
      futureSetting: { enabled: false },
    });
    expect(b.theme).toBe('dark');
    expect(b.startOfWeek).toBe('Sunday');
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  test('same-key updates remain last-writer-wins, including a return to the stale local value', async () => {
    const a = newSession();
    const b = newSession();
    await a.load();
    await b.load();
    await a.update({ theme: 'dark' });
    mockPost.mockClear();

    await b.update({ theme: 'auto' });

    expect(postedKeys()).toEqual(['theme']);
    expect(server.theme).toBe('auto');
  });

  test('fresh and same-session updates preserve earlier preferences and skip unchanged values', async () => {
    const a = newSession();
    await a.update({ theme: 'dark' });
    const fresh = newSession();
    await fresh.update({ startOfWeek: 'Sunday' });
    await fresh.update({ startOfDay: '05:00' });
    mockPost.mockClear();
    await fresh.update({ startOfWeek: 'Sunday' });

    expect(postedKeys()).toEqual([]);
    expect(server).toMatchObject({ theme: 'dark', startOfWeek: 'Sunday', startOfDay: '05:00' });
  });

  test('a rejected update propagates and its intended value can be retried without stale writes', async () => {
    const a = newSession();
    const b = newSession();
    await a.load();
    await b.load();
    await a.update({ theme: 'dark' });
    mockPost.mockClear();
    mockPost.mockRejectedValueOnce(new Error('offline'));

    await expect(b.update({ startOfWeek: 'Sunday' })).rejects.toThrow('offline');
    expect(b.startOfWeek).toBe('Sunday');
    expect(server.startOfWeek).toBe('Monday');
    expect(server.theme).toBe('dark');

    await b.save(['startOfWeek']);

    expect(postedKeys()).toEqual(['startOfWeek', 'startOfWeek']);
    expect(server).toMatchObject({ theme: 'dark', startOfWeek: 'Sunday' });
    expect(b.theme).toBe('dark');
  });

  test('a partial multi-key failure can retry the same update without reposting confirmed keys', async () => {
    const store = newSession();
    await store.load();
    const update = { startOfWeek: 'Sunday', startOfDay: '05:00' };
    mockPost
      .mockImplementationOnce(async (url, value) => {
        server[url.replace('/0/settings/', '')] = jsonCopy(value);
        return {};
      })
      .mockRejectedValueOnce(new Error('offline'));

    await expect(store.update(update)).rejects.toThrow('offline');
    expect(server.startOfDay).toBe('05:00');
    expect(server.startOfWeek).toBe('Monday');
    server.theme = 'dark';
    mockPost.mockClear();

    await store.update(update);

    expect(postedKeys()).toEqual(['startOfWeek']);
    expect(server).toMatchObject({ theme: 'dark', ...update });
  });

  test('empty updates and empty explicit saves never write unrelated differences', async () => {
    const store = newSession();
    await store.load();
    server.theme = 'dark';
    await store.update({});
    store.theme = 'light';
    await store.save([]);

    expect(postedKeys()).toEqual([]);
    expect(store.theme).toBe('dark');
  });

  test('save without keys retains full-state persistence and omits never-stored alerts', async () => {
    const store = newSession();
    await store.load();
    store.$patch({ theme: 'dark', landingpage: '/activity', durationDefault: 3600 });
    await store.save();

    expect(server).toMatchObject({
      theme: 'dark',
      landingpage: '/activity',
      durationDefault: 3600,
    });
    expect(server.alerts).toBeUndefined();
    expect(store.hasStoredAlerts).toBe(false);
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('landingpage')).toBe('/activity');
    expect(postedKeys().some(key => key.startsWith('_'))).toBe(false);
  });

  test('load with save migrates local settings and persists defaults without seeding alerts', async () => {
    server = {};
    localStorage.setItem('startOfWeek', 'Sunday');
    localStorage.setItem('locale', 'de');
    localStorage.setItem('requestTimeout', '45');
    const store = newSession();
    await store.load({ save: true });

    expect(server).toMatchObject({ startOfWeek: 'Sunday', locale: 'de', startOfDay: '04:00' });
    expect(server.alerts).toBeUndefined();
    expect(store.hasStoredAlerts).toBe(false);
    expect(i18n.locale).toBe('de');
    expect(mockDefaults.timeout).toBe(45000);
  });

  test('explicit empty alerts become stored only after a successful retry', async () => {
    const store = newSession();
    await store.load();
    mockPost.mockRejectedValueOnce(new Error('offline'));
    await expect(store.update({ alerts: [] })).rejects.toThrow('offline');
    expect(store.hasStoredAlerts).toBe(false);
    expect(server.alerts).toBeUndefined();

    await store.update({ alerts: [] });

    expect(postedKeys()).toEqual(['alerts', 'alerts']);
    expect(server.alerts).toEqual([]);
    expect(store.hasStoredAlerts).toBe(true);
    store.theme = 'dark';
    await store.save();
    expect(store.hasStoredAlerts).toBe(true);
  });

  test('scoped updates retain locale, timeout and early-render cache effects', async () => {
    const store = newSession();
    await store.update({
      locale: 'de',
      requestTimeout: 45,
      theme: 'dark',
      landingpage: '/activity',
    });

    expect(postedKeys().sort()).toEqual(['landingpage', 'locale', 'requestTimeout', 'theme']);
    expect(i18n.locale).toBe('de');
    expect(mockDefaults.timeout).toBe(45000);
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(localStorage.getItem('landingpage')).toBe('/activity');
  });

  test('saves before loading and private keys remain excluded', async () => {
    const store = newSession();
    await store.save(['theme']);
    expect(mockGetSettings).not.toHaveBeenCalled();
    expect(mockPost).not.toHaveBeenCalled();
    await store.load();
    await store.save(['_loaded', '_storedKeys']);
    expect(mockPost).not.toHaveBeenCalled();
  });
});
