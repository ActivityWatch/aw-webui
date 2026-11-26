import { createLocalVue, mount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import { createPinia, setActivePinia } from 'pinia';
import NoticeBell from '~/components/NoticeBell.vue';
import NoticeHost from '~/components/NoticeHost.vue';
import { useNoticesStore } from '~/stores/notices';
import { createClient, getClient } from '~/util/awclient';

const localVue = createLocalVue();
localVue.use(BootstrapVue);

const i18n = {
  mocks: {
    $t: (key: string) => key,
  },
  stubs: { icon: true },
};

describe('notices store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test('publishing marks a notice unseen once', () => {
    const notices = useNoticesStore();
    notices.publish('release');
    notices.publish('release');
    expect(notices.count).toBe(1);
    expect(notices.hasUnseen).toBe(true);
  });

  test('a notice arriving while the host is open is already seen', () => {
    const notices = useNoticesStore();
    notices.open();
    notices.publish('release');
    notices.close();
    expect(notices.ids).toEqual(['release']);
    expect(notices.hasUnseen).toBe(false);

    notices.publish('poll');
    expect(notices.hasUnseen).toBe(true);
  });

  test('withdrawing removes the notice and its unseen mark', () => {
    const notices = useNoticesStore();
    notices.publish('release');
    notices.withdraw('release');
    expect(notices.count).toBe(0);
    expect(notices.hasUnseen).toBe(false);
  });

  test('markAllSeen keeps the notice but clears the dot', () => {
    const notices = useNoticesStore();
    notices.publish('release');
    notices.markAllSeen();
    expect(notices.count).toBe(1);
    expect(notices.hasUnseen).toBe(false);
  });
});

describe('NoticeBell', () => {
  beforeEach(() => setActivePinia(createPinia()));

  function mountBell() {
    return mount(NoticeBell, { localVue, ...i18n });
  }

  test('shows no dot while nothing is waiting', () => {
    expect(mountBell().find('[data-testid="notice-bell-dot"]').exists()).toBe(false);
  });

  test('shows a dot for an unseen notice and opens the host on click', async () => {
    const wrapper = mountBell();
    const notices = useNoticesStore();
    notices.publish('release');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="notice-bell-dot"]').exists()).toBe(true);
    await wrapper.find('[data-testid="notice-bell"]').trigger('click');
    expect(notices.isOpen).toBe(true);
  });
});

describe('NoticeHost', () => {
  beforeEach(() => setActivePinia(createPinia()));

  function mountHost() {
    return mount(NoticeHost, {
      localVue,
      ...i18n,
      slots: { default: '<div data-testid="slotted">notice body</div>' },
      attachTo: document.body,
    });
  }

  test('keeps slotted notices mounted but the modal closed until the bell opens it', async () => {
    const wrapper = mountHost();
    await wrapper.vm.$nextTick();
    // Slotted notice components must stay mounted so they can run their own checks.
    expect(wrapper.find('[data-testid="slotted"]').exists()).toBe(true);
    expect(useNoticesStore().isOpen).toBe(false);
    expect(wrapper.find('.modal').isVisible()).toBe(false);
    wrapper.destroy();
  });

  test('opening the host clears the unseen dot', async () => {
    const wrapper = mountHost();
    const notices = useNoticesStore();
    notices.publish('release');
    notices.open();
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(notices.hasUnseen).toBe(false);
    expect(notices.count).toBe(1);
    wrapper.destroy();
  });

  test('says so when there is nothing to show', async () => {
    const wrapper = mountHost();
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="notice-empty"]').exists()).toBe(true);
    wrapper.destroy();
  });
});

describe('release notice in the host', () => {
  beforeEach(() => setActivePinia(createPinia()));

  test('publishes while visible, stays while the follow-up shows, withdraws when both are dismissed', async () => {
    createClient();
    const NewReleaseNotification = (await import('~/components/NewReleaseNotification.vue'))
      .default;
    // This test drives visibility directly; release discovery is covered below.
    // Do not let the mounted network/settings workflow race those transitions.
    const wrapper = mount({ ...NewReleaseNotification, mounted: jest.fn() }, {
      localVue,
      ...i18n,
      stubs: { icon: true, 'router-link': true },
    } as any);
    const notices = useNoticesStore();
    const vm: any = wrapper.vm;
    vm.isVisible = true;
    await wrapper.vm.$nextTick();
    expect(notices.ids).toEqual(['release']);

    vm.isVisible = false;
    vm.isFollowUpVisible = true;
    await wrapper.vm.$nextTick();
    expect(notices.ids).toEqual(['release']);

    notices.open();
    await wrapper.find('router-link-stub').trigger('click');
    expect(vm.isFollowUpVisible).toBe(false);
    expect(notices.isOpen).toBe(false);
    await wrapper.vm.$nextTick();
    expect(notices.ids).toEqual([]);
    wrapper.destroy();
  });
});

describe('release notice persistence', () => {
  beforeEach(() => setActivePinia(createPinia()));

  async function mountRelease(currentVersion: string | null, data: Record<string, any>) {
    let client;
    try {
      client = getClient();
    } catch {
      client = createClient();
    }
    const info = jest.spyOn(client, 'getInfo');
    if (currentVersion === null) info.mockRejectedValue(new Error('server unavailable'));
    else info.mockResolvedValue({ version: currentVersion } as any);
    const { useSettingsStore } = await import('~/stores/settings');
    const settings = useSettingsStore();
    jest.spyOn(settings, 'ensureLoaded').mockResolvedValue(undefined as any);
    const update = jest.spyOn(settings, 'update').mockImplementation(async (s: any) => {
      settings.$patch(s);
    });
    settings.$patch({ newReleaseCheckData: data, _storedKeys: ['newReleaseCheckData'] } as any);
    const NewReleaseNotification = (await import('~/components/NewReleaseNotification.vue'))
      .default;
    const wrapper = mount(NewReleaseNotification, {
      localVue,
      ...i18n,
      stubs: { icon: true, 'router-link': true },
    } as any);
    await new Promise(resolve => setTimeout(resolve, 20));
    return { wrapper, update, settings };
  }

  const future = '2999-01-01T00:00:00Z';

  test('an update not yet opened from the bell is restored after a reload, inside the backoff', async () => {
    const { wrapper, update } = await mountRelease('v0.1.0', {
      isEnabled: true,
      nextCheckTime: future,
      howOftenToCheck: 86400,
      timesChecked: 1,
      pendingVersion: '9.9.9',
    });
    expect(useNoticesStore().ids).toEqual(['release']);
    expect(update).not.toHaveBeenCalled();
    wrapper.destroy();
  });

  test('opening the host consumes the pending marker, so the next reload stays quiet', async () => {
    const { wrapper, settings } = await mountRelease('v0.1.0', {
      isEnabled: true,
      nextCheckTime: future,
      howOftenToCheck: 86400,
      timesChecked: 1,
      pendingVersion: '9.9.9',
    });
    useNoticesStore().open();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(settings.newReleaseCheckData.pendingVersion).toBeNull();
    expect(useNoticesStore().ids).toEqual(['release']); // still readable in this session
    wrapper.destroy();
  });

  test('an unknown current version preserves the unread marker until a later reload', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { wrapper, settings, update } = await mountRelease(null, {
      isEnabled: true,
      nextCheckTime: future,
      howOftenToCheck: 86400,
      timesChecked: 1,
      pendingVersion: '9.9.9',
    });
    expect(settings.newReleaseCheckData.pendingVersion).toBe('9.9.9');
    expect(update).not.toHaveBeenCalled();
    expect(useNoticesStore().ids).toEqual([]);
    wrapper.destroy();
    error.mockRestore();
  });

  test('a release restored into an already-open host is consumed too', async () => {
    useNoticesStore().open();
    const { wrapper, settings } = await mountRelease('v0.1.0', {
      isEnabled: true,
      nextCheckTime: future,
      howOftenToCheck: 86400,
      timesChecked: 1,
      pendingVersion: '9.9.9',
    });
    expect(settings.newReleaseCheckData.pendingVersion).toBeNull();
    expect(useNoticesStore().hasUnseen).toBe(false);
    expect(useNoticesStore().ids).toEqual(['release']);
    wrapper.destroy();
  });

  test('reading an overdue notice starts a full backoff from viewing, not discovery', async () => {
    const { wrapper, settings } = await mountRelease('v0.1.0', {
      isEnabled: true,
      nextCheckTime: '2000-01-01T00:00:00Z',
      howOftenToCheck: 86400,
      timesChecked: 1,
      pendingVersion: '9.9.9',
    });
    const openedAt = Date.now();
    useNoticesStore().open();
    await new Promise(resolve => setTimeout(resolve, 20));
    const deadline = new Date(settings.newReleaseCheckData.nextCheckTime).getTime();
    expect(deadline).toBeGreaterThanOrEqual(openedAt + 86400 * 1000);
    expect(deadline).toBeLessThanOrEqual(Date.now() + 86400 * 1000);
    expect(settings.newReleaseCheckData.pendingVersion).toBeNull();
    wrapper.destroy();
  });

  test('disable is visibly unavailable during the background save, then works', async () => {
    const { wrapper, settings, update } = await mountRelease('v0.1.0', {
      isEnabled: true,
      nextCheckTime: future,
      howOftenToCheck: 86400,
      timesChecked: 1,
      pendingVersion: '9.9.9',
    });
    let finishSave!: () => void;
    update.mockImplementationOnce(async (s: any) => {
      await new Promise<void>(resolve => {
        finishSave = resolve;
      });
      settings.$patch(s);
    });
    useNoticesStore().open();
    await wrapper.vm.$nextTick();
    const disable = wrapper.find('[data-testid="disable-release-check"]');
    expect(disable.exists()).toBe(true);
    expect(disable.attributes('disabled')).toBeDefined();
    await disable.trigger('click');
    expect(update).toHaveBeenCalledTimes(1);
    finishSave();
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(disable.attributes('disabled')).toBeUndefined();
    await disable.trigger('click');
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(settings.newReleaseCheckData.isEnabled).toBe(false);
    expect(wrapper.text()).toContain('ui.release.disabled');
    wrapper.destroy();
  });

  test('a pending update the user has since installed is dropped, not shown', async () => {
    const { wrapper, settings } = await mountRelease('v9.9.9', {
      isEnabled: true,
      nextCheckTime: future,
      howOftenToCheck: 86400,
      timesChecked: 1,
      pendingVersion: '9.9.9',
    });
    expect(useNoticesStore().ids).toEqual([]);
    expect(settings.newReleaseCheckData.pendingVersion).toBeNull();
    wrapper.destroy();
  });
});

describe('poll in the host', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  async function mountPoll() {
    const UserSatisfactionPoll = (await import('~/components/UserSatisfactionPoll.vue')).default;
    // Drive visibility directly; the settings/backoff workflow is covered in notificationPersistence.
    const wrapper = mount({ ...UserSatisfactionPoll, mounted: jest.fn() }, {
      localVue,
      ...i18n,
      stubs: { icon: true },
    } as any);
    const vm: any = wrapper.vm;
    vm.saveData = jest.fn().mockResolvedValue(true);
    return { wrapper, vm, notices: useNoticesStore() };
  }

  test('waits behind the bell, then opens on its own once after the dwell time', async () => {
    const { wrapper, vm, notices } = await mountPoll();
    vm.isPollVisible = true;
    await wrapper.vm.$nextTick();
    expect(notices.ids).toEqual(['poll']);
    expect(notices.hasUnseen).toBe(true);
    expect(notices.isOpen).toBe(false);

    jest.advanceTimersByTime(7999);
    expect(notices.isOpen).toBe(false);
    jest.advanceTimersByTime(1);
    expect(notices.isOpen).toBe(true);

    // The user closes it; it does not reopen by itself.
    notices.close();
    jest.advanceTimersByTime(60000);
    expect(notices.isOpen).toBe(false);
    wrapper.destroy();
  });

  test('counts a show once, when the host displays the poll', async () => {
    const { wrapper, vm, notices } = await mountPoll();
    vm.isPollVisible = true;
    await wrapper.vm.$nextTick();
    expect(vm.saveData).not.toHaveBeenCalled();
    jest.advanceTimersByTime(8000);
    await wrapper.vm.$nextTick();
    expect(vm.saveData).toHaveBeenCalledTimes(1);
    expect(vm.saveData).toHaveBeenCalledWith(expect.objectContaining({ timesPollIsShown: 1 }));
    notices.close();
    await wrapper.vm.$nextTick();
    notices.open();
    await wrapper.vm.$nextTick();
    expect(vm.saveData).toHaveBeenCalledTimes(1);
    wrapper.destroy();
  });

  test('a poll that becomes eligible in the open host is counted at once', async () => {
    const { wrapper, vm, notices } = await mountPoll();
    notices.open();
    await wrapper.vm.$nextTick();
    vm.isPollVisible = true;
    await wrapper.vm.$nextTick();
    expect(vm.saveData).toHaveBeenCalledWith(expect.objectContaining({ timesPollIsShown: 1 }));
    wrapper.destroy();
  });

  test('does not auto-open if the user already opened the host from the bell', async () => {
    const { wrapper, vm, notices } = await mountPoll();
    vm.isPollVisible = true;
    await wrapper.vm.$nextTick();
    notices.open();
    await wrapper.vm.$nextTick();
    notices.close();
    jest.advanceTimersByTime(60000);
    expect(notices.isOpen).toBe(false);
    wrapper.destroy();
  });

  test('opening and closing the host before the poll is eligible does not schedule a reopen', async () => {
    const { wrapper, vm, notices } = await mountPoll();
    notices.open();
    await wrapper.vm.$nextTick();
    vm.isPollVisible = true; // eligibility lands while the host is already open
    await wrapper.vm.$nextTick();
    notices.close();
    await wrapper.vm.$nextTick();
    jest.advanceTimersByTime(60000);
    expect(notices.isOpen).toBe(false);
    wrapper.destroy();
  });

  test('closing the host while an answer is saving discards the follow-up', async () => {
    const { wrapper, vm, notices } = await mountPoll();
    let finishSave;
    vm.saveData = jest.fn(() => new Promise(resolve => (finishSave = () => resolve(true))));
    vm.isPollVisible = true;
    await wrapper.vm.$nextTick();
    notices.open();
    await wrapper.vm.$nextTick();
    const answered = vm.choose(true);
    notices.close();
    await wrapper.vm.$nextTick();
    finishSave();
    await answered;
    await wrapper.vm.$nextTick();
    expect(vm.isPosFollowUpVisible).toBe(false);
    expect(notices.ids).toEqual([]);
    wrapper.destroy();
  });

  test('the answer only routes: positive goes to the attributed support page', async () => {
    const { wrapper, vm, notices } = await mountPoll();
    vm.isPollVisible = true;
    await wrapper.vm.$nextTick();
    notices.open();
    await wrapper.find('[data-testid="poll-positive"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(vm.saveData).toHaveBeenCalledWith(expect.objectContaining({ isEnabled: false }));
    expect(wrapper.find('[data-testid="poll-ask"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="poll-support"]').attributes('href')).toBe(
      'https://activitywatch.net/go/?src=inapp-poll'
    );
    expect(notices.ids).toEqual(['poll']);

    // Seen once the host closes: the follow-up is not listed again.
    notices.open();
    await wrapper.vm.$nextTick();
    notices.close();
    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();
    expect(notices.ids).toEqual([]);
    wrapper.destroy();
  });

  test('negative goes to the attributed feedback form', async () => {
    const { wrapper, vm, notices } = await mountPoll();
    vm.isPollVisible = true;
    await wrapper.vm.$nextTick();
    notices.open();
    await wrapper.find('[data-testid="poll-negative"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="poll-feedback"]').attributes('href')).toBe(
      'https://activitywatch.net/go/?src=inapp-survey&to=survey'
    );
    wrapper.destroy();
  });

  test('uses the host Close for deferral, with only a secondary permanent opt-out', async () => {
    const { wrapper, vm, notices } = await mountPoll();
    vm.isPollVisible = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[data-testid="poll-not-now"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="poll-dont-ask"]').classes()).toContain('btn-link');
    notices.open();
    await wrapper.vm.$nextTick();
    notices.close();
    await wrapper.vm.$nextTick();
    // Closing records nothing beyond the display itself.
    expect(vm.saveData).not.toHaveBeenCalledWith(expect.objectContaining({ isEnabled: false }));
    // Closing is temporary: the prompt remains accessible from the bell this load.
    expect(notices.ids).toEqual(['poll']);
    wrapper.destroy();
  });

  test('shows all ways to help without disclosure, with funding and word of mouth before reviews', async () => {
    const { wrapper, vm, notices } = await mountPoll();
    vm.isPollVisible = true;
    await wrapper.vm.$nextTick();
    notices.open();
    await wrapper.find('[data-testid="poll-positive"]').trigger('click');
    await wrapper.vm.$nextTick();
    const step = wrapper.find('[data-testid="poll-positive-step"]');
    expect(step.find('details').exists()).toBe(false);
    const items = step.findAll('li');
    expect(items.at(0).find('[data-testid="poll-support"]').exists()).toBe(true);
    expect(items.at(1).text()).toContain('ui.userPoll.tellFriends');
    expect(items.at(items.length - 1).text()).toContain('AlternativeTo');
    expect(step.text()).toContain('Discord');
    expect(step.text()).toContain('newsletter');
    wrapper.destroy();
  });

  test('"Don\'t ask again" disables the poll', async () => {
    const { wrapper, vm } = await mountPoll();
    vm.isPollVisible = true;
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-testid="poll-dont-ask"]').trigger('click');
    await wrapper.vm.$nextTick();
    expect(vm.saveData).toHaveBeenCalledWith(expect.objectContaining({ isEnabled: false }));
    expect(vm.isPollVisible).toBe(false);
    wrapper.destroy();
  });
});
