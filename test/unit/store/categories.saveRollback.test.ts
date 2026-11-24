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
        { id: 'alt', name: 'Alt', categories: [{ name: ['Hobby'], rule: { type: null } }] },
      ],
      active_set_ids: ['default'],
      classes: [{ name: ['Work'], rule: { type: null } }],
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

  // What a fresh page load (or Reset) shows for the categories.
  async function persistedView() {
    setActivePinia(createPinia());
    await useSettingsStore().load();
    const fresh = useCategoryStore();
    fresh.load();
    return { names: names(fresh), active: fresh.active_set_ids };
  }

  test('a rejected save restores the active set and classes too', async () => {
    const settings = useSettingsStore();
    await settings.load();
    const store = useCategoryStore();
    store.load();
    store.switchToSet('alt');
    store.addClass({ name: ['Unsaved'], rule: { type: null } });
    mockPost.mockRejectedValue(new Error('offline'));

    await expect(store.save()).rejects.toThrow('offline');

    expect(settings.active_set_ids).toEqual(['default']);
    expect(jsonCopy(settings.classes)).toEqual(server.classes);
    store.load();
    expect(store.active_set_ids).toEqual(['default']);
    expect(names(store)).toEqual([['Work']]);
  });

  test('after a partial write, Reset shows what the server saved', async () => {
    const settings = useSettingsStore();
    await settings.load();
    const store = useCategoryStore();
    store.load();
    store.switchToSet('alt');
    store.addClass({ name: ['Partial'], rule: { type: null } });
    // category_sets and classes are written, active_set_ids is rejected.
    mockPost.mockImplementation(async (url, value) => {
      const key = url.replace('/0/settings/', '');
      if (key === 'active_set_ids') throw new Error('rejected');
      server[key] = jsonCopy(value);
      return {};
    });

    await expect(store.save()).rejects.toThrow('rejected');

    expect(jsonCopy(settings.category_sets)).toEqual(server.category_sets);
    expect(jsonCopy(settings.active_set_ids)).toEqual(server.active_set_ids);
    expect(jsonCopy(settings.classes)).toEqual(server.classes);
    store.load();
    const reset = { names: names(store), active: store.active_set_ids };
    expect(reset).toEqual(await persistedView());
  });

  test('when settings cannot be reloaded either, the confirmed copy is restored', async () => {
    const settings = useSettingsStore();
    await settings.load();
    const store = useCategoryStore();
    store.load();
    store.switchToSet('alt');
    mockPost.mockRejectedValue(new Error('offline'));
    mockGetSettings.mockRejectedValue(new Error('offline'));

    await expect(store.save()).rejects.toThrow('offline');

    expect(settings.active_set_ids).toEqual(['default']);
    expect(jsonCopy(settings.category_sets)).toEqual(server.category_sets);
    expect(jsonCopy(settings.classes)).toEqual(server.classes);
  });
  test('with only legacy classes stored, Reset after a rejected first save shows the saved state', async () => {
    delete server.category_sets;
    delete server.active_set_ids;
    const settings = useSettingsStore();
    await settings.load();
    const store = useCategoryStore();
    store.load();
    store.addClass({ name: ['Unsaved'], rule: { type: null } });
    mockPost.mockRejectedValue(new Error('offline'));

    await expect(store.save()).rejects.toThrow('offline');

    store.load();
    expect(names(store)).toEqual([['Work']]);
  });

  test('a rejected category save keeps an unrelated preference awaiting retry', async () => {
    server.startOfWeek = 'Monday';
    const settings = useSettingsStore();
    await settings.load();
    mockPost.mockRejectedValue(new Error('offline'));
    await expect(settings.update({ startOfWeek: 'Sunday' })).rejects.toThrow('offline');
    expect(settings.startOfWeek).toBe('Sunday'); // kept so save() can retry it

    const store = useCategoryStore();
    store.load();
    store.addClass({ name: ['Unsaved'], rule: { type: null } });
    await expect(store.save()).rejects.toThrow('offline');

    expect(settings.startOfWeek).toBe('Sunday');
  });
});
