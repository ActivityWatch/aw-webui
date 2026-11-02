import { createLocalVue, shallowMount } from '@vue/test-utils';
import { PiniaVuePlugin, createPinia, setActivePinia } from 'pinia';
import VueI18n from 'vue-i18n';
import PrivacyFilterSettings from '~/views/settings/PrivacyFilterSettings.vue';
import { useSettingsStore } from '~/stores/settings';
import { formatPrivacyFilters } from '~/util/privacyFilters';
import { getClient } from '~/util/awclient';
import { i18n } from '~/i18n';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);
localVue.use(VueI18n);
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
    store.$patch({ _loaded: true, privacy_filters: [rule('old-secret')] });
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
    wrapper = shallowMount(PrivacyFilterSettings, { localVue, pinia, i18n });
    await flush();
    wrapper.vm.editorText = formatPrivacyFilters([rule('new-secret')]);
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.destroy();
    }
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

  it('keeps newly loaded server rules if both the write and recovery read fail', async () => {
    store.$patch({ _loaded: false, privacy_filters: [] });
    await flush();
    const read = jest
      .fn()
      .mockResolvedValueOnce(JSON.parse(JSON.stringify(server)))
      .mockRejectedValueOnce(new Error('recovery offline'))
      .mockImplementation(async () => JSON.parse(JSON.stringify(server)));
    getClient().get_settings = read;
    post.mockRejectedValueOnce(new Error('write offline'));

    await wrapper.vm.savePrivacyFilters();
    await flush();

    expect(read).toHaveBeenCalledTimes(2);
    expect(store.loaded).toBe(false);
    expect(store.privacy_filters).toEqual([rule('old-secret')]);
    expect(wrapper.vm.savedText).toBe(formatPrivacyFilters([rule('old-secret')]));
    expect(wrapper.vm.editorText).toContain('new-secret');
    expect(wrapper.vm.canSave).toBe(true);
    expect(wrapper.vm.saveError).toBe('write offline');

    await store.update({ theme: 'dark' });
    expect(server.privacy_filters).toEqual([rule('old-secret')]);
    wrapper.vm.resetEditor();
    expect(wrapper.vm.editorText).toBe(formatPrivacyFilters([rule('old-secret')]));
  });

  it.each([false, true])(
    'reloads before another settings update when recovery fails (write landed: %s)',
    async landed => {
      post.mockImplementationOnce(async (path, value) => {
        if (landed) server.privacy_filters = value;
        throw new Error('response lost');
      });
      const read = jest
        .fn()
        .mockRejectedValueOnce(new Error('recovery offline'))
        .mockRejectedValueOnce(new Error('still offline'))
        .mockImplementation(async () => JSON.parse(JSON.stringify(server)));
      getClient().get_settings = read;

      await wrapper.vm.savePrivacyFilters();
      await flush();
      expect(wrapper.vm.saveError).toBe('response lost');
      expect(wrapper.vm.editorText).toContain('new-secret');
      expect(wrapper.vm.canSave).toBe(true);
      post.mockClear();

      await expect(store.update({ theme: 'dark' })).rejects.toThrow('still offline');
      expect(post).not.toHaveBeenCalled();
      await store.update({ theme: 'dark' });
      await flush();

      const persistedRules = [rule(landed ? 'new-secret' : 'old-secret')];
      expect(server.theme).toBe('dark');
      expect(server.privacy_filters).toEqual(persistedRules);
      expect(store.privacy_filters).toEqual(persistedRules);
      expect(post.mock.calls.map(([path]) => path)).not.toContain('/0/settings/privacy_filters');
      wrapper.vm.resetEditor();
      expect(wrapper.vm.editorText).toBe(formatPrivacyFilters(persistedRules));
    }
  );

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

  it('keeps a revert to the previous rules typed while a save is pending', async () => {
    const saveGate = deferred();
    post.mockImplementationOnce(async (path, value) => {
      await saveGate.promise;
      server.privacy_filters = value;
    });
    const saving = wrapper.vm.savePrivacyFilters();
    await flush();
    wrapper.vm.editorText = formatPrivacyFilters([rule('old-secret')]);
    saveGate.resolve();
    await saving;
    await flush();

    expect(wrapper.vm.savedText).toContain('new-secret');
    expect(wrapper.vm.editorText).toContain('old-secret');
    expect(wrapper.vm.canSave).toBe(true);
  });

  it('restores the server rules after a rejected save', async () => {
    const saveGate = deferred();
    post.mockImplementationOnce(() => saveGate.promise);
    const saving = wrapper.vm.savePrivacyFilters();
    await flush();
    saveGate.reject(new Error('rejected by server'));
    await saving;
    await flush();
    expect(store.privacy_filters).toEqual([rule('old-secret')]);
    expect(wrapper.vm.saveError).toBe('rejected by server');
    expect(wrapper.vm.canSave).toBe(true);
  });

  it('adopts rules the server persisted before the request failed', async () => {
    post.mockImplementationOnce(async (path, value) => {
      server.privacy_filters = value;
      throw new Error('connection reset');
    });
    await wrapper.vm.savePrivacyFilters();
    await flush();
    expect(store.privacy_filters).toEqual([rule('new-secret')]);
    expect(wrapper.vm.savedText).toContain('new-secret');
    expect(wrapper.vm.hasUnsavedChanges).toBe(false);
    expect(wrapper.vm.saveError).toBe('');
  });

  it('recognizes a persisted write when the recovery read reorders object keys', async () => {
    post.mockImplementationOnce(async (path, value) => {
      // Rust serializes JSON object keys in sorted order, not input order.
      server.privacy_filters = value.map(item =>
        Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      );
      throw new Error('connection reset');
    });
    await wrapper.vm.savePrivacyFilters();
    await flush();

    expect(store.privacy_filters).toEqual([rule('new-secret')]);
    expect(wrapper.vm.saveError).toBe('');
    expect(wrapper.vm.hasUnsavedChanges).toBe(false);
    expect(wrapper.vm.editorText).toBe(wrapper.vm.savedText);
  });

  it('another setting saved during the request does not write old rules back', async () => {
    const saveGate = deferred();
    post.mockImplementationOnce(async (path, value) => {
      server.privacy_filters = value; // accepted, response still in flight
      await saveGate.promise;
    });
    const saving = wrapper.vm.savePrivacyFilters();
    await flush();
    await store.update({ theme: 'dark' });
    saveGate.resolve();
    await saving;
    await flush();
    expect(server.theme).toBe('dark');
    expect(server.privacy_filters).toEqual([rule('new-secret')]);
    expect(store.privacy_filters).toEqual([rule('new-secret')]);
  });
});
