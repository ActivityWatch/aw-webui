import Vue from 'vue';
import VueRouter from 'vue-router';
import Settings from '~/views/settings/Settings.vue';

const mockCategoryStore = { classes_unsaved_changes: true };
jest.mock('~/stores/categories', () => ({
  useCategoryStore: () => mockCategoryStore,
}));

Vue.use(VueRouter);

describe('Settings route leave confirmation', () => {
  test.each([
    [true, '/next'],
    [false, '/settings'],
    [null, '/settings'],
  ])('waits for the modal, then respects %s', async (confirmed, expectedPath) => {
    let resolveModal;
    const msgBoxConfirm = jest.fn(
      () =>
        new Promise(resolve => {
          resolveModal = resolve;
        })
    );
    const router = new VueRouter({
      mode: 'abstract',
      routes: [
        {
          path: '/settings',
          component: {
            render: h => h('div'),
            beforeRouteLeave: Settings.beforeRouteLeave,
            created() {
              this.$bvModal = { msgBoxConfirm };
              this.$t = key => key;
            },
          },
        },
        { path: '/next', component: { render: h => h('div') } },
      ],
    });
    const app = new Vue({ router, render: h => h('router-view') }).$mount();
    try {
      await router.push('/settings');
      await Vue.nextTick();
      const navigation = router.push('/next').catch(error => error);
      expect(msgBoxConfirm).toHaveBeenCalledTimes(1);
      expect(router.currentRoute.path).toBe('/settings');

      resolveModal(confirmed);
      const result = await navigation;
      expect(router.currentRoute.path).toBe(expectedPath);
      if (!confirmed) {
        expect(VueRouter.isNavigationFailure(result, VueRouter.NavigationFailureType.aborted)).toBe(
          true
        );
      }
    } finally {
      app.$destroy();
    }
  });
});
