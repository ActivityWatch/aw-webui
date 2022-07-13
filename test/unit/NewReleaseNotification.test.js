import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import NewReleaseNotification from '~/components/NewReleaseNotification';
import { createClient } from '~/util/awclient';

describe('hasNewRelease method', () => {
  const wrapper = shallowMount(NewReleaseNotification, {
    global: {
      plugins: [createTestingPinia()],
    },
  });
  const vm = wrapper.vm;
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
