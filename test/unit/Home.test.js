import Home from '~/views/Home.vue';

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
    const listeners = {};
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
