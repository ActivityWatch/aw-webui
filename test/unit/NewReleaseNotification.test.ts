import { createLocalVue, mount, shallowMount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import { createPinia, PiniaVuePlugin, setActivePinia } from 'pinia';
import { createTestingPinia } from '@pinia/testing';
import NewReleaseNotification from '~/components/NewReleaseNotification.vue';
import { useSettingsStore } from '~/stores/settings';
import { createClient } from '~/util/awclient';

describe('hasNewRelease method', () => {
  const wrapper = shallowMount(NewReleaseNotification, {
    global: {
      plugins: [createTestingPinia()],
    },
  } as any);
  const vm: any = wrapper.vm;
  createClient();

  test('should clean and compare version tags properly', () => {
    vm.currentVersion = vm.cleanVersionTag('v0.8.0');
    vm.latestVersion = vm.cleanVersionTag('v0.9.2');
    expect(vm.getHasNewRelease()).toBe(true);

    vm.currentVersion = vm.cleanVersionTag('v0.8.0 (rust)');
    vm.latestVersion = vm.cleanVersionTag('v0.9.2');
    expect(vm.getHasNewRelease()).toBe(true);

    vm.currentVersion = vm.cleanVersionTag('  v0.8.0 (rust)');
    vm.latestVersion = vm.cleanVersionTag('v0.9.2');
    expect(vm.getHasNewRelease()).toBe(true);

    vm.currentVersion = vm.cleanVersionTag('v0.9.1 (rust)');
    vm.latestVersion = vm.cleanVersionTag('v0.9.2');
    expect(vm.getHasNewRelease()).toBe(true);

    vm.currentVersion = vm.cleanVersionTag('v0.9.2 (rust)');
    vm.latestVersion = vm.cleanVersionTag('v0.9.2');
    expect(vm.getHasNewRelease()).toBe(false);

    // vm.currentVersion = vm.cleanVersionTag('v0.8.dev+c6433ea');
    // vm.latestVersion = vm.cleanVersionTag('v0.9.2');
    // expect(vm.getHasNewRelease()).toBe(true);

    // vm.currentVersion = vm.cleanVersionTag('v0.8.0b1');
    // vm.latestVersion = vm.cleanVersionTag('v0.9.2');
    // expect(vm.getHasNewRelease()).toBe(true);
  });
});

describe('disable link', () => {
  const localVue = createLocalVue();
  localVue.use(PiniaVuePlugin);
  localVue.use(BootstrapVue);

  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => jest.restoreAllMocks());

  test('disable link avoids javascript: URLs and still disables the check', async () => {
    const store = useSettingsStore();
    // Skip the release check in mounted(); the test shows the banner directly.
    jest.spyOn(store, 'ensureLoaded').mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const update = jest.spyOn(store, 'update').mockImplementation(async values => {
      store.$patch(values);
    });

    const wrapper = mount(NewReleaseNotification as any, {
      localVue,
      mocks: { $t: (key: string) => key },
      stubs: { 'router-link': true },
    });
    await wrapper.setData({ isVisible: true, latestVersion: '1.0.0' });

    const link = wrapper
      .findAll('a.alert-link')
      .wrappers.find(a => a.text() === 'ui.release.disable');
    if (!link) throw new Error('disable link not rendered');
    // The page CSP (script-src 'self' 'unsafe-eval') blocks javascript: navigations.
    expect(link.attributes('href')).not.toMatch(/^javascript:/i);

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.element.dispatchEvent(click);
    // A bare href="#" would send the hash router to /#/.
    expect(click.defaultPrevented).toBe(true);

    await new Promise(resolve => setTimeout(resolve));
    expect(update).toHaveBeenCalledWith({
      newReleaseCheckData: expect.objectContaining({ isEnabled: false }),
    });
    expect(wrapper.vm.isVisible).toBe(false);
    expect(wrapper.vm.isFollowUpVisible).toBe(true);
    wrapper.destroy();
  });
});
