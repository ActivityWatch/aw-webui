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
});
