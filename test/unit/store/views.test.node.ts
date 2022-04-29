import { setActivePinia, createPinia } from 'pinia';
import { useViewsStore } from '~/stores/views';

describe('views store', () => {
  setActivePinia(createPinia());
  const viewsStore = useViewsStore();

  beforeEach(() => {
    viewsStore.clearViews();
  });

  test('load default views', () => {
    expect(viewsStore.views).toHaveLength(0);
    viewsStore.load();
    expect(viewsStore.views).not.toHaveLength(0);
  });

  test('loads specific views', () => {
    expect(viewsStore.views).toHaveLength(0);
    viewsStore.loadViews([{ id: 'something', name: 'Something', elements: [] }]);
    expect(viewsStore.views).not.toHaveLength(0);
  });
});
