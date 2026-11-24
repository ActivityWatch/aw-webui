import { createPinia, setActivePinia } from 'pinia';

import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';

const mockGetSettings = jest.fn();
const mockPost = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    get_settings: mockGetSettings,
    req: { post: mockPost, defaults: { timeout: 0 } },
  }),
}));

const jsonCopy = value => JSON.parse(JSON.stringify(value));
const names = store => store.classes.map(c => c.name);

describe('categories save rollback', () => {
  let server: Record<string, any>;
  const env = process.env.NODE_ENV;

  beforeEach(() => {
    server = {
      category_sets: [
        { id: 'default', name: 'Default', categories: [{ name: ['Work'], rule: { type: null } }] },
      ],
      active_set_ids: ['default'],
    };
    mockGetSettings.mockReset().mockImplementation(async () => jsonCopy(server));
    mockPost.mockReset().mockImplementation(async (url, value) => {
      server[url.replace('/0/settings/', '')] = jsonCopy(value);
      return {};
    });
    localStorage.clear();
    setActivePinia(createPinia());
    // saveCategories skips persistence under NODE_ENV=test.
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = env;
  });

  test('a rejected save does not leave the draft in settings for Reset to reload', async () => {
    await useSettingsStore().load();
    const store = useCategoryStore();
    store.load();
    store.addClass({ name: ['Unsaved'], rule: { type: null } });
    mockPost.mockRejectedValue(new Error('offline'));

    await expect(store.save()).rejects.toThrow('offline');
    expect(store.classes_unsaved_changes).toBe(true);

    // Reset reloads from the settings store: it must see the confirmed state.
    store.load();
    expect(names(store)).toEqual([['Work']]);
    expect(store.classes_unsaved_changes).toBe(false);
  });

  test('a successful save after a rejected one persists the retried draft', async () => {
    await useSettingsStore().load();
    const store = useCategoryStore();
    store.load();
    store.addClass({ name: ['Retry'], rule: { type: null } });
    mockPost.mockRejectedValueOnce(new Error('offline'));
    await expect(store.save()).rejects.toThrow('offline');

    await store.save();

    store.load();
    expect(names(store)).toEqual([['Work'], ['Retry']]);
    expect(server.category_sets[0].categories.map(c => c.name)).toEqual([['Work'], ['Retry']]);
  });
});
