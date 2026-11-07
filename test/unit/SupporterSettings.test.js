import { createLocalVue, shallowMount } from '@vue/test-utils';
import { PiniaVuePlugin, createPinia, setActivePinia } from 'pinia';
import VueI18n from 'vue-i18n';
import SupporterSettings from '~/views/settings/SupporterSettings.vue';
import { useSettingsStore } from '~/stores/settings';
import { getClient } from '~/util/awclient';
import { i18n } from '~/i18n';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);
localVue.use(VueI18n);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('SupporterSettings', () => {
  let pinia, store, wrapper, server, post;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    store = useSettingsStore();
    store.$patch({ _loaded: true });
    server = JSON.parse(JSON.stringify(store.$state));
    delete server.supporter;
    post = jest.fn(async (path, value) => {
      server[path.split('/').pop()] = value;
    });
    getClient.mockReturnValue({
      get_settings: async () => JSON.parse(JSON.stringify(server)),
      req: { post, defaults: {} },
    });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    localStorage.clear();
    wrapper = shallowMount(SupporterSettings, {
      localVue,
      pinia,
      i18n,
      stubs: ['b-form-checkbox'],
    });
  });

  afterEach(() => {
    wrapper.destroy();
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('persists the final choice when the first toggle is still saving', async () => {
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    post.mockImplementationOnce(async (path, value) => {
      await gate;
      server[path.split('/').pop()] = value;
    });

    wrapper.vm.supporter = true;
    await flush();
    expect(post).toHaveBeenCalledWith('/0/settings/supporter', true, expect.anything());
    wrapper.vm.supporter = false;
    await flush();
    release();
    await wrapper.vm.saveQueue;

    expect(server.supporter).toBe(false);
    expect(store.supporter).toBe(false);
    expect(wrapper.vm.supporter).toBe(false);
    expect(
      post.mock.calls.filter(([path]) => path === '/0/settings/supporter').map(([, value]) => value)
    ).toEqual([true, false]);
  });

  it('preserves selection order after leaving and reopening Settings', async () => {
    server.supporter = false;
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    post.mockImplementationOnce(async (path, value) => {
      await gate;
      server[path.split('/').pop()] = value;
    });

    wrapper.vm.supporter = true;
    await flush();
    expect(post).toHaveBeenCalledWith('/0/settings/supporter', true, expect.anything());
    const firstSave = wrapper.vm.saveQueue;
    wrapper.destroy();
    // Settings.init() reloads the persisted value on each route entry.
    await store.load();
    expect(store.supporter).toBe(false);
    wrapper = shallowMount(SupporterSettings, {
      localVue,
      pinia,
      i18n,
      stubs: ['b-form-checkbox'],
    });
    expect(wrapper.vm.supporter).toBe(true);
    wrapper.vm.supporter = false;
    expect(wrapper.vm.supporter).toBe(false);
    await flush();
    release();
    await Promise.all([firstSave, wrapper.vm.saveQueue]);

    expect(server.supporter).toBe(false);
    expect(store.supporter).toBe(false);
    expect(wrapper.vm.supporter).toBe(false);
    expect(
      post.mock.calls.filter(([path]) => path === '/0/settings/supporter').map(([, value]) => value)
    ).toEqual([true, false]);
  });

  it('still saves a later choice after a rejected write', async () => {
    const error = new Error('connection lost');
    post.mockRejectedValueOnce(error);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    wrapper.vm.supporter = true;
    await wrapper.vm.saveQueue;
    wrapper.vm.supporter = true;
    await wrapper.vm.saveQueue;

    expect(console.error).toHaveBeenCalledWith('Could not save supporter preference', error);
    expect(server.supporter).toBe(true);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it('shows a failed save across remounts and clears the error after a successful save', async () => {
    post.mockRejectedValueOnce(new Error('connection lost'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    wrapper.vm.supporter = true;
    await wrapper.vm.saveQueue;
    await wrapper.vm.$nextTick();

    expect(server.supporter).toBeUndefined();
    expect(wrapper.find('[role="alert"]').text()).toContain('Failed to save settings');
    expect(wrapper.find('[role="alert"]').text()).toContain('connection lost');
    wrapper.destroy();
    wrapper = shallowMount(SupporterSettings, {
      localVue,
      pinia,
      i18n,
      stubs: ['b-form-checkbox'],
    });
    expect(wrapper.find('[role="alert"]').text()).toContain('connection lost');

    wrapper.vm.supporter = false;
    await wrapper.vm.saveQueue;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.vm.supporter).toBe(false);
  });

  it('honours the legacy flag until an explicit choice clears it', async () => {
    localStorage.setItem('aw-supporter', 'true');
    wrapper.destroy();
    wrapper = shallowMount(SupporterSettings, {
      localVue,
      pinia,
      i18n,
      stubs: ['b-form-checkbox'],
    });
    expect(wrapper.vm.supporter).toBe(true);
    wrapper.vm.supporter = false;
    await wrapper.vm.saveQueue;

    expect(localStorage.getItem('aw-supporter')).toBeNull();
    expect(wrapper.vm.supporter).toBe(false);
  });
});
