import { setActivePinia, createPinia } from 'pinia';
import { useViewsStore } from '~/stores/views';

beforeEach(() => {
  setActivePinia(createPinia());
  const viewsStore = useViewsStore();
  viewsStore.clearViews();
});

test('load default views', () => {
  const viewsStore = useViewsStore();
  expect(viewsStore.views).toHaveLength(0);
  viewsStore.load();
  expect(viewsStore.views).not.toHaveLength(0);
});

test('loads specific views', () => {
  const viewsStore = useViewsStore();
  expect(viewsStore.views).toHaveLength(0);
  viewsStore.loadViews([{ id: 'something', name: 'Something', elements: [] }]);
  expect(viewsStore.views).not.toHaveLength(0);
});
