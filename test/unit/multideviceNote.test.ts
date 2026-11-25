import { createLocalVue, mount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import { createPinia, setActivePinia } from 'pinia';
import Activity from '~/views/activity/Activity.vue';
import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { useViewsStore } from '~/stores/views';
import {
  isMultideviceNoteDismissed,
  persistMultideviceNoteDismissed,
} from '~/util/multideviceNote';

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    abort: jest.fn(),
    getEvents: jest.fn().mockResolvedValue([]),
  }),
}));

describe('multi-device note dismissal', () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('is shown until dismissed', () => {
    expect(isMultideviceNoteDismissed()).toBe(false);
  });

  test('stays dismissed once dismissed', () => {
    persistMultideviceNoteDismissed();
    expect(isMultideviceNoteDismissed()).toBe(true);
  });

  test('renders compact dismissible alert without conflicting spacing utilities and dismisses on close click', async () => {
    const localVue = createLocalVue();
    localVue.use(BootstrapVue);
    localVue.filter('friendlyduration', (val: number) => `${val}s`);
    localVue.filter('friendlyperiod', (val: string) => val);

    const bucketsStore = useBucketsStore();
    bucketsStore.buckets = [
      {
        id: 'aw-watcher-window_desktop',
        type: 'currentwindow',
        client: 'aw-watcher-window',
        hostname: 'desktop',
        created: '2026-11-22T00:00:00Z',
      },
      {
        id: 'aw-watcher-android-test_phone',
        type: 'currentwindow',
        client: 'aw-watcher-android-test',
        hostname: 'phone',
        created: '2026-11-22T00:00:00Z',
      },
    ] as any;

    const settingsStore = useSettingsStore();
    jest.spyOn(settingsStore, 'ensureLoaded').mockResolvedValue(undefined);
    const viewsStore = useViewsStore();
    jest.spyOn(viewsStore, 'load').mockResolvedValue(undefined);
    const categoryStore = useCategoryStore();
    jest.spyOn(categoryStore, 'load').mockImplementation(() => undefined);
    const activityStore = useActivityStore();
    jest.spyOn(activityStore, 'ensure_loaded').mockResolvedValue(undefined);
    jest.spyOn(activityStore, 'reset').mockResolvedValue(undefined);

    const wrapper = mount(Activity, {
      localVue,
      propsData: {
        host: '@all',
        date: '2026-11-22',
        periodLength: 'day',
      },
      mocks: {
        $t: (key: string) => key,
        $route: { params: { view_id: 'summary' }, query: {}, meta: { subview: 'view' } },
        $router: { push: jest.fn(), replace: jest.fn() },
      },
      stubs: {
        transition: false,
        'b-modal': true,
        'b-tooltip': true,
        'input-date': true,
        'aw-periodusage': true,
        'aw-watcher-liveness-banner': true,
        'aw-uncategorized-notification': true,
        'aw-devonly': true,
        'router-link': true,
        'router-view': true,
        icon: true,
      },
    });

    await wrapper.vm.$nextTick();

    const note = wrapper.find('[data-testid="multidevice-note"]');
    expect(note.exists()).toBe(true);
    expect(note.classes()).toEqual(
      expect.arrayContaining(['alert', 'alert-dismissible', 'alert-compact', 'small'])
    );
    expect(note.classes()).not.toContain('py-1');
    expect(note.classes()).not.toContain('px-2');

    const closeButton = note.find('button.close');
    expect(closeButton.exists()).toBe(true);
    await closeButton.trigger('click');
    await wrapper.vm.$nextTick();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await wrapper.vm.$nextTick();

    expect(isMultideviceNoteDismissed()).toBe(true);
    expect(wrapper.find('[data-testid="multidevice-note"]').exists()).toBe(false);
    wrapper.destroy();
  });
});
