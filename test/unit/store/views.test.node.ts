import { setActivePinia, createPinia } from 'pinia';
import { useViewsStore, androidViews, defaultViews, migrateStoredViews } from '~/stores/views';

describe('views store', () => {
  setActivePinia(createPinia());
  const viewsStore = useViewsStore();

  beforeEach(() => {
    viewsStore.clearViews();
  });

  test('load default views', async () => {
    expect(viewsStore.views).toHaveLength(0);
    await viewsStore.load();
    expect(viewsStore.views).not.toHaveLength(0);
  });

  test('loads specific views', () => {
    expect(viewsStore.views).toHaveLength(0);
    viewsStore.loadViews([{ id: 'something', name: 'Something', elements: [] }]);
    expect(viewsStore.views).not.toHaveLength(0);
  });
});

// The desktop default as Android builds stored it before the --os=android fix.
const storedDesktopDefault = () => [
  {
    id: 'summary',
    name: 'Summary',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_titles', size: 3 },
      { type: 'timeline_barchart', size: 3 },
      { type: 'top_categories', size: 3 },
      { type: 'category_tree', size: 3 },
      { type: 'category_sunburst', size: 3 },
    ],
  },
  {
    id: 'window',
    name: 'Window',
    elements: [
      { type: 'top_apps', size: 3 },
      { type: 'top_titles', size: 3 },
    ],
  },
  {
    id: 'browser',
    name: 'Browser',
    elements: [
      { type: 'top_domains', size: 3 },
      { type: 'top_urls', size: 3 },
      { type: 'top_browser_titles', size: 3 },
    ],
  },
  {
    id: 'editor',
    name: 'Editor',
    elements: [
      { type: 'top_editor_files', size: 3 },
      { type: 'top_editor_projects', size: 3 },
      { type: 'top_editor_languages', size: 3 },
    ],
  },
];

describe('migrateStoredViews', () => {
  test('replaces a stored desktop default on Android', () => {
    const migrated = migrateStoredViews(storedDesktopDefault(), true);
    expect(migrated).toEqual(androidViews);
    expect(migrated).not.toBe(androidViews);
  });

  test('replaces the pre-top_browser_titles desktop default on Android', () => {
    const stored = storedDesktopDefault();
    stored[2].elements = stored[2].elements.filter(el => el.type !== 'top_browser_titles');
    expect(migrateStoredViews(stored, true)).toEqual(androidViews);
  });

  test('historical matching is independent of future desktop default changes', () => {
    const original = defaultViews[0].elements.slice();
    try {
      defaultViews[0].elements.push({ type: 'future_visualization', size: 3 });
      const stored = storedDesktopDefault();
      expect(migrateStoredViews(stored, true)).toEqual(androidViews);
      stored[2].elements = stored[2].elements.filter(el => el.type !== 'top_browser_titles');
      expect(migrateStoredViews(stored, true)).toEqual(androidViews);
    } finally {
      defaultViews[0].elements = original;
    }
  });

  test('keeps the stored desktop default off Android', () => {
    const stored = storedDesktopDefault();
    expect(migrateStoredViews(stored, false)).toBe(stored);
  });

  test('keeps views the user edited', () => {
    const removedTab = storedDesktopDefault().slice(0, 3);
    expect(migrateStoredViews(removedTab, true)).toBe(removedTab);

    const resized = storedDesktopDefault();
    resized[0].elements[0].size = 6;
    expect(migrateStoredViews(resized, true)).toBe(resized);

    const withProps = storedDesktopDefault();
    withProps[1].elements[0]['props'] = { limit: 20 };
    expect(migrateStoredViews(withProps, true)).toBe(withProps);
  });

  test('keeps Android views and missing values as they are', () => {
    expect(migrateStoredViews(androidViews, true)).toBe(androidViews);
    expect(migrateStoredViews(undefined, true)).toBeUndefined();
  });
});

describe('views store on an Android build', () => {
  const OLD_ENV = process.env.VUE_APP_ON_ANDROID;
  afterEach(() => {
    if (OLD_ENV === undefined) {
      delete process.env.VUE_APP_ON_ANDROID;
    } else {
      process.env.VUE_APP_ON_ANDROID = OLD_ENV;
    }
  });

  // Fresh module instances, so `onAndroid` is read from the env set here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function loadOnAndroid(stored: any[]) {
    process.env.VUE_APP_ON_ANDROID = 'true';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mods: any;
    jest.isolateModules(() => {
      mods = {
        pinia: require('pinia'),
        views: require('~/stores/views'),
        settings: require('~/stores/settings'),
      };
    });
    mods.pinia.setActivePinia(mods.pinia.createPinia());
    const settingsStore = mods.settings.useSettingsStore();
    settingsStore.$patch({ views: stored, _loaded: true });
    const save = jest.spyOn(settingsStore, 'save').mockResolvedValue(undefined);
    const update = jest.spyOn(settingsStore, 'update');
    const viewsStore = mods.views.useViewsStore();
    await viewsStore.load();
    return {
      views: viewsStore.views,
      expected: mods.views.androidViews,
      viewsStore,
      settingsStore,
      save,
      update,
    };
  }

  test('load() shows the Android views when a desktop default is stored', async () => {
    const stored = storedDesktopDefault();
    const { views, expected, settingsStore, save, update } = await loadOnAndroid(stored);
    expect(views).toEqual(expected);
    expect(settingsStore.views).toEqual(storedDesktopDefault());
    expect(save).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  test('saving an edit persists the migrated Android layout', async () => {
    const { viewsStore, settingsStore, expected, save, update } = await loadOnAndroid(
      storedDesktopDefault()
    );
    viewsStore.addVisualization({ view_id: 'summary', type: 'top_titles' });
    await viewsStore.save();
    const edited = JSON.parse(JSON.stringify(expected));
    edited[0].elements.push({ type: 'top_titles' });
    expect(update).toHaveBeenCalledWith({ views: edited });
    expect(settingsStore.views).toEqual(edited);
    expect(save).toHaveBeenCalledTimes(1);
    expect(viewsStore.views).toEqual(edited);
    expect(expected[0].elements).not.toContainEqual({ type: 'top_titles' });
  });

  test('load() keeps stored views the user edited', async () => {
    const edited = storedDesktopDefault().slice(0, 2);
    const { views } = await loadOnAndroid(edited);
    expect(views).toEqual(edited);
  });
});

describe('editable view ownership and persistence', () => {
  const confirmed = () => [
    {
      id: 'custom',
      name: 'Custom',
      elements: [
        { type: 'top_apps', size: 3, props: { nested: { limit: 5 } } },
        { type: 'top_titles', size: 6 },
      ],
    },
  ];

  beforeEach(() => {
    setActivePinia(createPinia());
    jest.restoreAllMocks();
  });

  async function setup() {
    const { useSettingsStore } = await import('~/stores/settings');
    const settings = useSettingsStore();
    settings.$patch({ views: confirmed(), _loaded: true });
    const views = useViewsStore();
    await views.load();
    return { settings, views };
  }

  test('add, remove, reorder, type and nested props edits never alter confirmed settings', async () => {
    const { settings, views } = await setup();
    views.views[0].elements[0].props.nested['limit'] = 20;
    views.editView({ view_id: 'custom', el_id: '1', type: 'top_domains', props: { limit: 10 } });
    views.setElements({ view_id: 'custom', elements: [...views.views[0].elements].reverse() });
    views.addVisualization({ view_id: 'custom', type: 'top_urls' });
    views.removeVisualization({ view_id: 'custom', el_id: 1 });
    expect(settings.views).toEqual(confirmed());
    await views.load();
    expect(views.views).toEqual(confirmed());
  });

  test('each restore creates pristine independent defaults and Cancel recovers custom views', async () => {
    const { views } = await setup();
    const pristine = JSON.parse(JSON.stringify(defaultViews));
    views.restoreDefaults();
    views.removeVisualization({ view_id: 'summary', el_id: 0 });
    views.restoreDefaults();
    expect(views.views).toEqual(pristine);
    expect(defaultViews).toEqual(pristine);
    await views.load();
    expect(views.views).toEqual(confirmed());
  });

  test('save waits for persistence and owns the confirmed snapshot after success', async () => {
    const { settings, views } = await setup();
    let resolveSave!: () => void;
    jest.spyOn(settings, 'save').mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveSave = resolve;
        })
    );
    views.addVisualization({ view_id: 'custom', type: 'top_urls' });
    let finished = false;
    const saving = views.save().then(() => {
      finished = true;
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(finished).toBe(false);
    resolveSave();
    await saving;
    const saved = JSON.parse(JSON.stringify(settings.views));
    views.removeVisualization({ view_id: 'custom', el_id: 0 });
    expect(settings.views).toEqual(saved);
    await views.load();
    expect(views.views).toEqual(saved);
  });

  test('rejected saves keep retryable edits but Cancel retains the confirmed baseline', async () => {
    const { settings, views } = await setup();
    jest.spyOn(settings, 'save').mockRejectedValue(new Error('offline'));
    views.addVisualization({ view_id: 'custom', type: 'top_urls' });
    const draft = JSON.parse(JSON.stringify(views.views));
    await expect(views.save()).rejects.toThrow('offline');
    expect(views.views).toEqual(draft);
    expect(settings.views).toEqual(confirmed());
    await views.load();
    expect(views.views).toEqual(confirmed());
    views.loadViews(draft);
    jest.spyOn(settings, 'save').mockResolvedValue(undefined);
    await views.save();
    expect(settings.views).toEqual(draft);
    views.removeVisualization({ view_id: 'custom', el_id: 0 });
    await views.load();
    expect(views.views).toEqual(draft);
  });
});

describe('view edits through the real settings HTTP lifecycle', () => {
  test('failed persistence keeps Cancel safe and retry establishes a new baseline', async () => {
    const { useSettingsStore } = await import('~/stores/settings');
    const { createClient, getClient } = await import('~/util/awclient');
    setActivePinia(createPinia());
    createClient();
    const client = getClient();
    const previousRequest = client.req;
    const previousStorage = (global as any).localStorage;
    (global as any).localStorage = { setItem: jest.fn(), getItem: () => null };
    const settings = useSettingsStore();
    const initialViews = [{ id: 'custom', name: 'Custom', elements: [{ type: 'top_apps' }] }];
    settings.$patch({ views: initialViews, _loaded: true });
    const copy = value => JSON.parse(JSON.stringify(value));
    const backend = copy(settings.$state);
    const read = jest.spyOn(client, 'get_settings').mockImplementation(async () => copy(backend));
    let failViews = true;
    const post = jest.fn(async (url, value) => {
      const key = url.split('/').pop();
      if (key === 'views' && failViews) throw new Error('offline');
      backend[key] = copy(value);
      return {};
    });
    (client as any).req = { post, defaults: {} };
    try {
      const views = useViewsStore();
      await views.load();
      views.addVisualization({ view_id: 'custom', type: 'top_urls' });
      await expect(views.save()).rejects.toThrow('offline');
      expect(backend.views).toEqual(initialViews);
      expect(settings.views).toEqual(initialViews);
      expect(views.views[0].elements).toHaveLength(2);
      await views.load();
      expect(views.views).toEqual(initialViews);
      views.addVisualization({ view_id: 'custom', type: 'top_urls' });
      failViews = false;
      await views.save();
      expect(backend.views[0].elements).toHaveLength(2);
      expect(settings.views).toEqual(backend.views);
      views.removeVisualization({ view_id: 'custom', el_id: 0 });
      await views.load();
      expect(views.views).toEqual(backend.views);
      expect(views.views[0].elements).toHaveLength(2);
    } finally {
      read.mockRestore();
      client.req = previousRequest;
      if (previousStorage === undefined) delete (global as any).localStorage;
      else (global as any).localStorage = previousStorage;
    }
  });
});
