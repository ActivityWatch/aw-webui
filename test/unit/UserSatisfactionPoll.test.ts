import { createLocalVue, mount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import { createPinia, PiniaVuePlugin, setActivePinia } from 'pinia';
import UserSatisfactionPoll from '~/components/UserSatisfactionPoll.vue';
import { useSettingsStore } from '~/stores/settings';

describe("don't show again link", () => {
  const localVue = createLocalVue();
  localVue.use(PiniaVuePlugin);
  localVue.use(BootstrapVue);

  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => jest.restoreAllMocks());

  test('stays on the current route and disables the poll', async () => {
    const store = useSettingsStore();
    // Skip the scheduling in mounted(); the test shows the poll directly.
    jest.spyOn(store, 'ensureLoaded').mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const update = jest.spyOn(store, 'update').mockImplementation(async values => {
      store.$patch(values);
    });

    const wrapper = mount(UserSatisfactionPoll as any, {
      localVue,
      mocks: { $t: (key: string) => key },
    });
    await wrapper.setData({ isPollVisible: true });

    const link = wrapper.findAll('a').wrappers.find(a => a.text() === 'ui.userPoll.dontShowAgain');
    if (!link) throw new Error("don't show again link not rendered");

    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.element.dispatchEvent(click);
    // Following href="#" would leave the hash router showing the old page at /#/.
    expect(click.defaultPrevented).toBe(true);

    await new Promise(resolve => setTimeout(resolve));
    expect(update).toHaveBeenCalledWith({
      userSatisfactionPollData: expect.objectContaining({ isEnabled: false }),
    });
    expect(wrapper.vm.isPollVisible).toBe(false);
    wrapper.destroy();
  });
});
