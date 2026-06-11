import { setActivePinia, createPinia } from 'pinia';
import { setLocale } from '~/i18n';
import { useSettingsStore } from '~/stores/settings';
import { useViewsStore } from '~/stores/views';

describe('views store', () => {
  let viewsStore: ReturnType<typeof useViewsStore>;

  beforeEach(() => {
    setLocale('en');
    setActivePinia(createPinia());
    viewsStore = useViewsStore();
    viewsStore.clearViews();
  });

  afterEach(() => {
    setLocale('en');
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

  test('loads default view names in zh-CN', async () => {
    setLocale('zh-CN');

    await viewsStore.load();

    expect(viewsStore.views.map(view => view.name)).toContain('概览');
  });

  test('saves localized default views with canonical English names', async () => {
    setLocale('zh-CN');
    await viewsStore.load();

    const settingsStore = useSettingsStore();
    await viewsStore.save();

    expect(settingsStore.views.find(view => view.id === 'summary')).toMatchObject({
      name: 'Summary',
      nameKey: 'views.summary',
    });
  });
});
