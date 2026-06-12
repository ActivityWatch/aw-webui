import { setActivePinia, createPinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { DEFAULT_LOCALE, getLocale, setLocale } from '~/i18n';

const App = require('~/App.vue').default;

const postMock = jest.fn();
const getSettingsMock = jest.fn();
let consoleLogSpy: jest.SpyInstance;

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    get_settings: getSettingsMock,
    req: {
      defaults: {
        timeout: 0,
      },
      post: postMock,
    },
  }),
}));

type MemoryStorage = Storage & {
  store: Record<string, string>;
};

function createLocalStorage(items: Record<string, string> = {}): MemoryStorage {
  const storage = {
    store: { ...items },
    get length() {
      return Object.keys(this.store).length;
    },
    clear() {
      this.store = {};
    },
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null;
    },
    key(index: number) {
      return Object.keys(this.store)[index] ?? null;
    },
    removeItem(key: string) {
      delete this.store[key];
    },
    setItem(key: string, value: string) {
      this.store[key] = String(value);
    },
  };

  return new Proxy(storage, {
    get(target, property) {
      if (typeof property === 'string' && property in target.store) {
        return target.store[property];
      }

      return target[property];
    },
    ownKeys(target) {
      return Reflect.ownKeys(target.store);
    },
    getOwnPropertyDescriptor(target, property) {
      if (typeof property === 'string' && property in target.store) {
        return {
          configurable: true,
          enumerable: true,
          value: target.store[property],
        };
      }

      return undefined;
    },
  }) as MemoryStorage;
}

describe('settings store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getSettingsMock.mockResolvedValue({});
    postMock.mockResolvedValue({});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: createLocalStorage(),
    });
    setLocale(DEFAULT_LOCALE);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    jest.clearAllMocks();
    setLocale(DEFAULT_LOCALE);
  });

  test('ensureLoaded coalesces concurrent loads', async () => {
    const settingsStore = useSettingsStore();
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
    const settingsStore = useSettingsStore();
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

  test('defaults to English', () => {
    const settingsStore = useSettingsStore();
    expect(settingsStore.language).toBe('en');
  });

  test('can update language in store state', () => {
    const settingsStore = useSettingsStore();
    settingsStore.$patch({ language: 'zh-CN' });
    expect(settingsStore.language).toBe('zh-CN');
  });

  test('loads supported language from server settings', async () => {
    getSettingsMock.mockResolvedValue({ language: 'zh-CN' });
    const settingsStore = useSettingsStore();

    await settingsStore.load();

    expect(settingsStore.language).toBe('zh-CN');
  });

  test('falls back to default language when server settings contain an unsupported language', async () => {
    getSettingsMock.mockResolvedValue({ language: 'fr-FR' });
    const settingsStore = useSettingsStore();

    await settingsStore.load();

    expect(settingsStore.language).toBe(DEFAULT_LOCALE);
  });

  test.each(['true', 'false'])(
    'falls back to default language when server settings contain boolean-like language %s',
    async language => {
      getSettingsMock.mockResolvedValue({ language });
      const settingsStore = useSettingsStore();

      await settingsStore.load();

      expect(settingsStore.language).toBe(DEFAULT_LOCALE);
    }
  );

  test('falls back to default language when localStorage contains an unsupported language', async () => {
    getSettingsMock.mockResolvedValue({});
    Object.defineProperty(global, 'localStorage', {
      configurable: true,
      value: createLocalStorage({ language: 'fr-FR' }),
    });
    const settingsStore = useSettingsStore();

    await settingsStore.load();

    expect(settingsStore.language).toBe(DEFAULT_LOCALE);
  });

  test.each(['true', 'false'])(
    'falls back to default language when localStorage contains boolean-like language %s',
    async language => {
      getSettingsMock.mockResolvedValue({});
      Object.defineProperty(global, 'localStorage', {
        configurable: true,
        value: createLocalStorage({ language }),
      });
      const settingsStore = useSettingsStore();

      await settingsStore.load();

      expect(settingsStore.language).toBe(DEFAULT_LOCALE);
    }
  );

  test('saves language through the backend settings endpoint', async () => {
    getSettingsMock.mockResolvedValue({});
    const settingsStore = useSettingsStore();
    settingsStore.$patch({
      _loaded: true,
      language: 'zh-CN',
    });

    await settingsStore.save();

    expect(postMock).toHaveBeenCalledWith('/0/settings/language', 'zh-CN', {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  test('App language watcher syncs the active locale', () => {
    const watcher = (App as any).watch.language;

    watcher('zh-CN');
    expect(getLocale()).toBe('zh-CN');

    watcher('en');
    expect(getLocale()).toBe('en');
  });
});
