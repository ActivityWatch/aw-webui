import { createLocalVue, shallowMount } from '@vue/test-utils';
import { PiniaVuePlugin, createPinia, setActivePinia } from 'pinia';
import PrivacyFilterSettings from '~/views/settings/PrivacyFilterSettings.vue';
import { useSettingsStore } from '~/stores/settings';
import { formatPrivacyFilters } from '~/util/privacyFilters';
import { getClient } from '~/util/awclient';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const rule = pattern => ({
  enabled: true,
  bucket_prefix: 'aw-watcher-window',
  field: 'title',
  pattern,
  action: 'drop',
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('PrivacyFilterSettings save outcomes', () => {
  let pinia, store, wrapper, server, post;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    store = useSettingsStore();
    store.$patch({ loaded: true, privacy_filters: [rule('old-secret')] });
    // Complete server snapshot, so the only changed POST is privacy_filters.
    server = JSON.parse(JSON.stringify(store.$state));
    post = jest.fn(async (path, value) => {
      server[path.split('/').pop()] = value;
    });
    getClient.mockReturnValue({
      get_settings: async () => JSON.parse(JSON.stringify(server)),
      req: { post, defaults: {} },
    });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    wrapper = shallowMount(PrivacyFilterSettings, { localVue, pinia });
    await flush();
    wrapper.vm.editorText = formatPrivacyFilters([rule('new-secret')]);
  });

  afterEach(() => {
    wrapper.destroy();
    jest.restoreAllMocks();
  });

  it('keeps a failed draft retryable and restores the persisted rules', async () => {
    post.mockRejectedValueOnce(new Error('synthetic offline'));
    await wrapper.vm.savePrivacyFilters();
    await flush();

    expect(wrapper.vm.saveError).toBe('synthetic offline');
    expect(server.privacy_filters).toEqual([rule('old-secret')]);
    expect(store.privacy_filters).toEqual([rule('old-secret')]);
    expect(wrapper.vm.editorText).toContain('new-secret');
    expect(wrapper.vm.savedText).toContain('old-secret');
    expect(wrapper.vm.hasUnsavedChanges).toBe(true);
    expect(wrapper.vm.canSave).toBe(true);

    wrapper.vm.resetEditor();
    expect(wrapper.vm.editorText).toContain('old-secret');
    expect(wrapper.vm.editorText).not.toContain('new-secret');
  });

  it('retries a failed draft and then confirms it as the baseline', async () => {
    post.mockRejectedValueOnce(new Error('synthetic offline'));
    await wrapper.vm.savePrivacyFilters();
    await flush();
    await wrapper.vm.savePrivacyFilters();
    await flush();

    expect(post).toHaveBeenCalledTimes(2);
    expect(server.privacy_filters).toEqual([rule('new-secret')]);
    expect(wrapper.vm.saveError).toBe('');
    expect(store.privacy_filters).toEqual([rule('new-secret')]);
    expect(wrapper.vm.savedText).toContain('new-secret');
    expect(wrapper.vm.hasUnsavedChanges).toBe(false);
  });

  it('keeps edits made while a save is pending', async () => {
    const saveGate = deferred();
    post.mockImplementationOnce(async (path, value) => {
      await saveGate.promise;
      server.privacy_filters = value;
    });
    const saving = wrapper.vm.savePrivacyFilters();
    await flush();
    expect(wrapper.vm.savedText).toContain('old-secret');
    wrapper.vm.editorText = formatPrivacyFilters([rule('newer-secret')]);
    saveGate.resolve();
    await saving;
    await flush();

    expect(wrapper.vm.savedText).toContain('new-secret');
    expect(wrapper.vm.editorText).toContain('newer-secret');
    expect(wrapper.vm.hasUnsavedChanges).toBe(true);
  });
});
