const mockGetSettings = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    get_settings: mockGetSettings,
    req: {
      defaults: { timeout: 0 },
      post: jest.fn(),
    },
  }),
}));

import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { getAppLocale, setAppLocale } from '~/i18n';

describe('settings store locale loading', () => {
  let settingsStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    settingsStore = useSettingsStore();
    settingsStore.$reset();
    settingsStore.$patch({ _loaded: false });
    mockGetSettings.mockReset();
    mockGetSettings.mockResolvedValue({});
    setAppLocale('en');
    localStorage.clear();
  });

  test('load ignores removed settings keys', async () => {
    mockGetSettings.mockResolvedValue({ showYearly: true, useMultidevice: true });
    localStorage.setItem('showYearly', 'true');
    localStorage.setItem('useMultidevice', 'true');

    await settingsStore.load();

    for (const key of ['showYearly', 'useMultidevice']) {
      expect(key in settingsStore.$state).toBe(false);
      expect(settingsStore._storedKeys).not.toContain(key);
    }
  });

  test('load applies valid locale from server', async () => {
    mockGetSettings.mockResolvedValue({ locale: 'de' });

    await settingsStore.load();

    expect(settingsStore.locale).toBe('de');
    expect(getAppLocale()).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    expect(settingsStore.loaded).toBe(true);
  });

  test('load ignores invalid locale from server', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(jest.fn());
    mockGetSettings.mockResolvedValue({ locale: 'fr' });

    await settingsStore.load();

    expect(warn).toHaveBeenCalledWith('Ignoring invalid locale from server:', 'fr');
    expect(settingsStore.locale).toBe('en');
    warn.mockRestore();
  });

  test('load applies valid locale from localStorage', async () => {
    localStorage.setItem('locale', 'zh-CN');
    mockGetSettings.mockResolvedValue({});

    await settingsStore.load();

    expect(settingsStore.locale).toBe('zh-CN');
    expect(getAppLocale()).toBe('zh-CN');
  });

  test('load ignores invalid locale from localStorage', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(jest.fn());
    localStorage.setItem('locale', 'xx');
    mockGetSettings.mockResolvedValue({});

    await settingsStore.load();

    expect(warn).toHaveBeenCalledWith('Ignoring invalid locale from storage:', 'xx');
    expect(settingsStore.locale).toBe('en');
    warn.mockRestore();
  });
});
