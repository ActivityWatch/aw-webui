import { setActivePinia, createPinia } from 'pinia';

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

import { useSettingsStore } from '~/stores/settings';
import { i18n } from '~/i18n';

function mockLocalStorage() {
  const store: Record<string, string> = {};
  const storage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
  Object.defineProperty(global, 'localStorage', { value: storage, configurable: true });
}

describe('settings store', () => {
  setActivePinia(createPinia());
  const settingsStore = useSettingsStore();

  beforeEach(() => {
    mockLocalStorage();
    settingsStore.$reset();
    settingsStore.$patch({ _loaded: false });
    jest.restoreAllMocks();
    mockGetSettings.mockReset();
    mockGetSettings.mockResolvedValue({});
    i18n.locale = 'en';
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

  test('load syncs store locale from i18n when no saved locale exists', async () => {
    i18n.locale = 'uk';
    mockGetSettings.mockResolvedValue({});

    await settingsStore.load();

    expect(settingsStore.locale).toBe('uk');
  });
});
