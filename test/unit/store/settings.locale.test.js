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
import { i18n } from '~/i18n';

describe('settings store locale loading', () => {
  let settingsStore;

  beforeEach(() => {
    setActivePinia(createPinia());
    settingsStore = useSettingsStore();
    settingsStore.$reset();
    settingsStore.$patch({ _loaded: false });
    mockGetSettings.mockReset();
    mockGetSettings.mockResolvedValue({});
    i18n.locale = 'en';
    localStorage.clear();
  });

  test('load applies valid locale from server', async () => {
    mockGetSettings.mockResolvedValue({ locale: 'de' });

    await settingsStore.load();

    expect(settingsStore.locale).toBe('de');
    expect(i18n.locale).toBe('de');
    expect(document.documentElement.lang).toBe('de');
    expect(settingsStore.loaded).toBe(true);
  });

  test('load ignores invalid locale from server', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetSettings.mockResolvedValue({ locale: 'fr' });

    await settingsStore.load();

    expect(warn).toHaveBeenCalledWith('Ignoring invalid locale from server:', 'fr');
    expect(settingsStore.locale).toBe('en');
    warn.mockRestore();
  });

  test('load applies valid locale from localStorage', async () => {
    localStorage.setItem('locale', 'ru');
    mockGetSettings.mockResolvedValue({});

    await settingsStore.load();

    expect(settingsStore.locale).toBe('ru');
    expect(i18n.locale).toBe('ru');
  });

  test('load ignores invalid locale from localStorage', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('locale', 'xx');
    mockGetSettings.mockResolvedValue({});

    await settingsStore.load();

    expect(warn).toHaveBeenCalledWith('Ignoring invalid locale from storage:', 'xx');
    expect(settingsStore.locale).toBe('en');
    warn.mockRestore();
  });
});
