import { createApp, h, nextTick } from 'vue';
import {
  createMemoryHistory,
  createRouter,
  isNavigationFailure,
  NavigationFailureType,
  RouterView,
} from 'vue-router';
import SettingsComponent from '~/views/settings/Settings.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const Settings: any = SettingsComponent;

const mockCategoryStore = { classes_unsaved_changes: true };
jest.mock('~/stores/categories', () => ({
  useCategoryStore: () => mockCategoryStore,
}));

describe('Settings route leave confirmation', () => {
  test.each([
    [true, '/next'],
    [false, '/settings'],
    [null, '/settings'],
  ])('waits for the modal, then respects %s', async (confirmed, expectedPath) => {
    let resolveModal;
    const confirm = jest.fn(
      () =>
        new Promise(resolve => {
          resolveModal = resolve;
        })
    );
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/settings',
          component: {
            render: () => h('div'),
            beforeRouteLeave: Settings.beforeRouteLeave,
            setup: () => ({ modalController: { confirm } }),
          },
        },
        { path: '/next', component: { render: () => h('div') } },
      ],
    });
    const app = createApp({ render: () => h(RouterView) });
    app.config.globalProperties.$t = key => key;
    app.use(router);
    app.mount(document.createElement('div'));
    try {
      await router.push('/settings');
      await nextTick();
      const navigation = router.push('/next');
      await nextTick();
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(router.currentRoute.value.path).toBe('/settings');

      resolveModal(confirmed);
      const result = await navigation;
      expect(router.currentRoute.value.path).toBe(expectedPath);
      if (!confirmed) {
        expect(isNavigationFailure(result, NavigationFailureType.aborted)).toBe(true);
      }
    } finally {
      app.unmount();
    }
  });
});
