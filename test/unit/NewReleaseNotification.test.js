import { shallowMount } from '@vue/test-utils';
import NewReleaseNotification from '~/components/NewReleaseNotification';

describe('hasNewRelease method', () => {
  const wrapper = shallowMount(NewReleaseNotification, {
    mocks: {
      $aw: {
        // Provide dummy function because it won't find vm.$aw during test
        getInfo() {
          return;
        },
      },
    },
  });
  const vm = wrapper.vm;

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
