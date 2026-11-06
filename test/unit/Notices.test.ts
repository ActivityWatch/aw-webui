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
    const wrapper = mount(NewReleaseNotification, {
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

  async function mountRelease(currentVersion: string, data: Record<string, any>) {
    let client;
    try {
      client = getClient();
    } catch {
      client = createClient();
    }
    jest.spyOn(client, 'getInfo').mockResolvedValue({ version: currentVersion } as any);
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
