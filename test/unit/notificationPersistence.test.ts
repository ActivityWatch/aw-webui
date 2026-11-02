import { createLocalVue, shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import NewReleaseNotification from '~/components/NewReleaseNotification.vue';
import UserSatisfactionPoll from '~/components/UserSatisfactionPoll.vue';
import { useSettingsStore } from '~/stores/settings';

const mockGetSettings = jest.fn();
const mockPost = jest.fn();
const mockGetInfo = jest.fn();
const mockGetRelease = jest.fn();
jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    get_settings: mockGetSettings,
    getInfo: mockGetInfo,
    req: { post: mockPost, defaults: { timeout: 0 } },
  }),
}));
jest.mock('axios', () => ({ get: (...args) => mockGetRelease(...args) }));

const NOW = Date.parse('2026-10-30T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const jsonCopy = value => JSON.parse(JSON.stringify(value));
const releaseData = (patch = {}) => ({
  isEnabled: true,
  nextCheckTime: moment(NOW - DAY).toISOString(),
  howOftenToCheck: DAY / 1000,
  timesChecked: 0,
  ...patch,
});
const pollData = (patch = {}) => ({
  isEnabled: true,
  nextPollTime: moment(NOW - DAY).toISOString(),
  timesPollIsShown: 0,
  ...patch,
});
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('notification settings persistence', () => {
  let server: Record<string, any>;
  let wrappers: any[];
  const mountNotification = component => {
    const localVue = createLocalVue();
    const wrapper: any = shallowMount(component, {
      localVue,
      mocks: { $t: key => key },
      stubs: ['b-alert', 'router-link'],
    });
    wrappers.push(wrapper);
    return wrapper;
  };
  const newSession = () => {
    setActivePinia(createPinia());
    return useSettingsStore();
  };

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    server = { theme: 'dark' };
    wrappers = [];
    localStorage.clear();
    newSession();
    mockGetSettings.mockReset().mockImplementation(async () => jsonCopy(server));
    mockPost.mockReset().mockImplementation(async (url, value) => {
      server[url.replace('/0/settings/', '')] = jsonCopy(value);
      return {};
    });
    mockGetInfo.mockReset().mockResolvedValue({ version: 'v1.0.0' });
    mockGetRelease.mockReset().mockResolvedValue({
      data: { tag_name: 'v2.0.0', published_at: moment(NOW - 8 * DAY).toISOString() },
    });
  });
  afterEach(() => {
    wrappers.forEach(wrapper => wrapper.destroy());
    jest.restoreAllMocks();
  });

  test.each([
    [NewReleaseNotification, 'newReleaseCheckData', 'nextCheckTime', DAY],
    [UserSatisfactionPoll, 'userSatisfactionPollData', 'nextPollTime', 7 * DAY],
  ])(
    'initial deadline survives a fresh-session remount (%s)',
    async (component, key, timeKey, wait) => {
      mountNotification(component);
      await flush();
      expect(server[key]).toBeDefined();
      const deadline = server[key][timeKey];
      expect(Date.parse(deadline)).toBe(NOW + Number(wait));
      jest.spyOn(Date, 'now').mockReturnValue(NOW + DAY / 2);
      newSession();
      mockPost.mockClear();
      mountNotification(component);
      await flush();
      expect(server[key][timeKey]).toBe(deadline);
      expect(mockPost).not.toHaveBeenCalled();
      expect(mockGetRelease).not.toHaveBeenCalled();
    }
  );

  test.each([
    [NewReleaseNotification, 'newReleaseCheckData', 'isVisible'],
    [UserSatisfactionPoll, 'userSatisfactionPollData', 'isPollVisible'],
  ])('failed initial deadline save can retry on remount (%s)', async (component, key, visible) => {
    let rejectDeadline = true;
    mockPost.mockImplementation(async (url, value) => {
      const setting = url.replace('/0/settings/', '');
      if (setting === key && rejectDeadline) {
        rejectDeadline = false;
        throw new Error('offline');
      }
      server[setting] = jsonCopy(value);
      return {};
    });
    const failed = mountNotification(component);
    await flush();
    expect(server[key]).toBeUndefined();
    expect(useSettingsStore()._storedKeys).not.toContain(key);
    expect(failed.vm[visible]).toBe(false);
    expect(mockGetRelease).not.toHaveBeenCalled();
    failed.destroy();
    newSession();
    const retried = mountNotification(component);
    await flush();
    expect(server[key]).toBeDefined();
    expect(useSettingsStore()._storedKeys).toContain(key);
    expect(retried.vm[visible]).toBe(false);
  });

  test.each([
    [NewReleaseNotification, 'isVisible'],
    [UserSatisfactionPoll, 'isPollVisible'],
  ])(
    'failed initial settings load does not write or show a notification (%s)',
    async (component, visible) => {
      mockGetSettings.mockRejectedValueOnce(new Error('offline'));
      const wrapper = mountNotification(component);
      await flush();
      expect(wrapper.vm[visible]).toBe(false);
      expect(mockPost).not.toHaveBeenCalled();
      expect(mockGetInfo).not.toHaveBeenCalled();
      expect(mockGetRelease).not.toHaveBeenCalled();
      expect(server).toEqual({ theme: 'dark' });
    }
  );

  test.each([3, 4])(
    'an enabled poll already shown %i times is disabled without another display',
    async count => {
      server.userSatisfactionPollData = pollData({ timesPollIsShown: count });
      const wrapper = mountNotification(UserSatisfactionPoll);
      await flush();
      expect(wrapper.vm.isPollVisible).toBe(false);
      expect(server.userSatisfactionPollData).toMatchObject({
        isEnabled: false,
        timesPollIsShown: count,
        nextPollTime: moment(NOW - DAY).toISOString(),
      });
    }
  );

  test('release disable persists and survives reload', async () => {
    server.newReleaseCheckData = releaseData();
    const wrapper = mountNotification(NewReleaseNotification);
    await flush();
    expect(wrapper.vm.isVisible).toBe(true);
    await wrapper.vm.disableCheck();
    expect(server.newReleaseCheckData.isEnabled).toBe(false);
    expect(wrapper.vm.isVisible).toBe(false);
    expect(wrapper.vm.isFollowUpVisible).toBe(true);
    const fresh = newSession();
    await fresh.load();
    expect(fresh.newReleaseCheckData.isEnabled).toBe(false);
    expect(server.theme).toBe('dark');
  });

  test('due release check persists the counter and long backoff', async () => {
    server.newReleaseCheckData = releaseData({ timesChecked: 4 });
    const wrapper = mountNotification(NewReleaseNotification);
    await flush();
    expect(wrapper.vm.isVisible).toBe(true);
    expect(server.newReleaseCheckData.timesChecked).toBe(5);
    expect(Date.parse(server.newReleaseCheckData.nextCheckTime)).toBe(NOW + 5 * DAY);
    expect(server.newReleaseCheckData.howOftenToCheck).toBe((5 * DAY) / 1000);
  });

  test.each([0, 1, 2])(
    'poll awaits loading and persists display %i with its backoff',
    async count => {
      server.userSatisfactionPollData = pollData({ timesPollIsShown: count });
      let finishLoad;
      mockGetSettings.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finishLoad = () => resolve(jsonCopy(server));
          })
      );
      const wrapper = mountNotification(UserSatisfactionPoll);
      await flush();
      expect(mockGetSettings).toHaveBeenCalledTimes(1);
      expect(wrapper.vm.isPollVisible).toBe(false);
      expect(mockPost).not.toHaveBeenCalled();
      finishLoad();
      await flush();
      expect(wrapper.vm.isPollVisible).toBe(true);
      expect(server.userSatisfactionPollData).toMatchObject({
        timesPollIsShown: count + 1,
        isEnabled: count < 2,
      });
      expect(Date.parse(server.userSatisfactionPollData.nextPollTime)).toBe(NOW + 7 * DAY);
      newSession();
      const remounted = mountNotification(UserSatisfactionPoll);
      await flush();
      expect(remounted.vm.isPollVisible).toBe(false);
    }
  );

  test.each([
    [NewReleaseNotification, 'newReleaseCheckData', 'isVisible'],
    [UserSatisfactionPoll, 'userSatisfactionPollData', 'isPollVisible'],
  ])(
    'stored disabled preference suppresses checks and writes (%s)',
    async (component, key, visible) => {
      server[key] =
        key === 'newReleaseCheckData'
          ? releaseData({ isEnabled: false })
          : pollData({ isEnabled: false });
      const wrapper = mountNotification(component);
      await flush();
      expect(wrapper.vm[visible]).toBe(false);
      expect(mockGetInfo).not.toHaveBeenCalled();
      expect(mockGetRelease).not.toHaveBeenCalled();
      expect(mockPost).not.toHaveBeenCalled();
    }
  );

  test.each([
    [NewReleaseNotification, 'newReleaseCheckData', 'disableCheck', 'isVisible'],
    [UserSatisfactionPoll, 'userSatisfactionPollData', 'dontShowAgain', 'isPollVisible'],
    [UserSatisfactionPoll, 'userSatisfactionPollData', 'submit', 'isPollVisible'],
  ])(
    'failed disable retains visible state and can retry (%s, %s, %s)',
    async (component, key, action, visible) => {
      server[key] = key === 'newReleaseCheckData' ? releaseData() : pollData();
      await useSettingsStore().load();
      const wrapper = mountNotification(component);
      await flush();
      wrapper.vm.rating = '8';
      expect(wrapper.vm[visible]).toBe(true);
      mockPost.mockRejectedValueOnce(new Error('offline'));
      // Components may report the failure locally or propagate it to their caller.
      await Promise.resolve()
        .then(() => wrapper.vm[action]())
        .catch(() => undefined);
      await flush();
      expect(wrapper.vm[visible]).toBe(true);
      expect(
        wrapper.vm.isFollowUpVisible ||
          wrapper.vm.isPosFollowUpVisible ||
          wrapper.vm.isNegFollowUpVisible
      ).toBeFalsy();
      expect(server[key].isEnabled).toBe(true);
      expect(useSettingsStore()[key].isEnabled).toBe(true);
      await wrapper.vm[action]();
      expect(server[key].isEnabled).toBe(false);
      expect(wrapper.vm[visible]).toBe(false);
    }
  );
});
