import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import HomeComponent from '~/views/Home.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const Home: any = HomeComponent;

describe('Home supporter nudge', () => {
  test('does not show after another tab snoozes during async evaluation', () => {
    const vm = {
      isSupporter: jest.fn().mockReturnValue(false),
      isSupporterNudgeSnoozed: jest.fn().mockReturnValue(true),
      supporterNudgeSrc: '',
      supporterNudgeVisible: false,
    };

    Home.methods.showSupporterNudge.call(vm, 'inapp-tenure');

    expect(vm.supporterNudgeSrc).toBe('');
    expect(vm.supporterNudgeVisible).toBe(false);
  });

  test('hides a visible nudge when another tab snoozes it', () => {
    const listeners: Record<string, any> = {};
    const addEventListenerSpy = jest
      .spyOn(window, 'addEventListener')
      .mockImplementation((type, listener) => {
        listeners[type] = listener;
      });
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    const vm = {
      isSupporter: jest.fn().mockReturnValue(false),
      isSupporterNudgeSnoozed: jest.fn().mockReturnValue(true),
      supporterNudgeVisible: true,
    };

    Home.methods.startSupporterStorageSync.call(vm);
    listeners.storage({ key: 'aw-supporter-nudge-dismissed-until' });

    expect(vm.supporterNudgeVisible).toBe(false);

    Home.methods.stopSupporterStorageSync.call(vm);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', listeners.storage);

    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});

describe('Home subscribe CTA src', () => {
  let wrapper: any;

  afterEach(() => {
    if (wrapper) {
      wrapper.destroy();
      wrapper = null;
    }
  });

  function mountHome(isAndroid: boolean) {
    createTestingPinia();
    wrapper = shallowMount(Home, {
      mocks: { $isAndroid: isAndroid },
      stubs: ['b-alert', 'b-button', 'router-link'],
    });
    return wrapper;
  }

  function subscribeHref(vmWrapper: any): string {
    const link = vmWrapper
      .findAll('a')
      .wrappers.find((a: any) => a.text().includes('Support ActivityWatch'));
    expect(link).toBeTruthy();
    return link.attributes('href');
  }

  test('desktop href uses inapp-home', () => {
    const mounted = mountHome(false);
    expect(mounted.vm.subscribeUrl).toBe('https://activitywatch.net/go/?src=inapp-home');
    expect(subscribeHref(mounted)).toBe('https://activitywatch.net/go/?src=inapp-home');
  });

  test('android href uses inapp-home-android', () => {
    const mounted = mountHome(true);
    expect(mounted.vm.subscribeUrl).toBe('https://activitywatch.net/go/?src=inapp-home-android');
    expect(subscribeHref(mounted)).toBe('https://activitywatch.net/go/?src=inapp-home-android');
  });
});
