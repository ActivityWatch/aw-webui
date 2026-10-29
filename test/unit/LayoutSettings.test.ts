const mockGetSettings = jest.fn();
const mockPost = jest.fn();
jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    get_settings: mockGetSettings,
    req: { defaults: { timeout: 0 }, post: mockPost },
  }),
}));
jest.mock('~/stores/server', () => ({ useServerStore: () => ({ getInfo: jest.fn() }) }));

import Vue from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount, shallowMount } from '@vue/test-utils';
import { useSettingsStore } from '~/stores/settings';

import App from '~/App.vue';
import { i18n } from '~/i18n';

const flush = async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
  await Vue.nextTick();
};

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  mockGetSettings.mockReset().mockResolvedValue({});
  mockPost.mockReset();
  jest.spyOn(console, 'log').mockImplementation(jest.fn());
});
afterEach(() => jest.restoreAllMocks());

async function persistentStore() {
  const store = useSettingsStore();
  await store.load();
  const server = { ...store.$state };
  mockGetSettings.mockImplementation(async () => ({ ...server }));
  mockPost.mockImplementation(async (url, value) => {
    server[url.split('/').pop()] = value;
  });
  return store;
}

describe('persisted layout preferences', () => {
  test('defaults preserve text and automatic route width', async () => {
    const store = await persistentStore();
    expect(store.textSize).toBe(100);
    expect(store.contentWidth).toBe(0);
  });

  test('loads numeric local fallback and prioritizes server values', async () => {
    localStorage.setItem('textSize', '80');
    localStorage.setItem('contentWidth', '600');
    const store = useSettingsStore();
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([80, 600]);
    mockGetSettings.mockResolvedValue({ textSize: 150, contentWidth: 2400 });
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([150, 2400]);
  });

  test.each([null, true, '120', -1, 79, 151, NaN, Infinity, {}, 110.5])(
    'invalid server text size %p defaults, including on reload',
    async value => {
      const store = useSettingsStore();
      store.$patch({ textSize: 125 });
      mockGetSettings.mockResolvedValue({ textSize: value });
      await store.load();
      expect(store.textSize).toBe(100);
    }
  );

  test.each([null, false, '1000', -1, 1, 599, 2401, NaN, Infinity, {}, 800.5])(
    'invalid server width %p defaults',
    async value => {
      mockGetSettings.mockResolvedValue({ contentWidth: value });
      const store = await persistentStore();
      expect(store.contentWidth).toBe(0);
    }
  );

  test.each(['', 'null', 'bad', 'true', 'Infinity', '-1', '79', '151'])(
    'invalid local text size %p defaults',
    async value => {
      localStorage.setItem('textSize', value);
      const store = await persistentStore();
      expect(store.textSize).toBe(100);
    }
  );

  test.each(['', 'null', 'bad', 'false', 'Infinity', '-1', '599', '2401', '900.5'])(
    'invalid local content width %p defaults',
    async value => {
      localStorage.setItem('contentWidth', value);
      const store = await persistentStore();
      expect(store.contentWidth).toBe(0);
    }
  );

  test('rejects invalid updates before applying or posting either preference', async () => {
    const store = await persistentStore();
    await expect(store.update({ textSize: 120, contentWidth: 599 })).rejects.toThrow('Invalid');
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
    expect(mockPost).not.toHaveBeenCalled();
  });

  test('a missing value resets to defaults on reload instead of retaining stale state', async () => {
    const store = await persistentStore();
    store.$patch({ textSize: 140, contentWidth: 1800 });
    mockGetSettings.mockResolvedValue({});
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
  });

  test('independent updates survive a new store and reset both through existing persistence', async () => {
    let store = await persistentStore();
    await store.update({ textSize: 140 });
    expect(store.contentWidth).toBe(0);
    await store.update({ contentWidth: 1800 });
    expect(store.textSize).toBe(140);
    setActivePinia(createPinia());
    store = useSettingsStore();
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([140, 1800]);
    await store.update({ textSize: 100, contentWidth: 0 });
    setActivePinia(createPinia());
    store = useSettingsStore();
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
    expect(localStorage.getItem('textSize')).toBeNull();
    expect(localStorage.getItem('contentWidth')).toBeNull();
  });

  test('an older rejected update cannot roll back a newer successful update', async () => {
    const store = await persistentStore();
    const originalPost = mockPost.getMockImplementation();
    let rejectFirst: (error: Error) => void;
    mockPost.mockImplementation((url, value, ...args) => {
      if (url.endsWith('/textSize') && value === 130) {
        return new Promise((_, reject) => {
          rejectFirst = reject;
        });
      }
      return originalPost(url, value, ...args);
    });
    const first = store.update({ textSize: 130 });
    const rejected = first.catch(error => error);
    await flush();
    await store.update({ textSize: 140 });
    expect(store.textSize).toBe(140);
    rejectFirst(new Error('offline'));
    expect(await rejected).toEqual(new Error('offline'));
    expect(store.textSize).toBe(140);
    await store.load();
    expect(store.textSize).toBe(140);
  });

  test.each([false, true])(
    'two rejected overlapping updates restore the original value (older fails first: %s)',
    async olderFirst => {
      const store = await persistentStore();
      const rejectPosts: Array<(error: Error) => void> = [];
      mockPost.mockImplementation(() => new Promise((_, reject) => rejectPosts.push(reject)));
      const first = store.update({ textSize: 130 }).catch(error => error);
      await flush();
      const second = store.update({ textSize: 140 }).catch(error => error);
      await flush();
      const order = olderFirst ? [0, 1] : [1, 0];
      for (const index of order) {
        rejectPosts[index](new Error('offline'));
        await flush();
      }
      expect(await first).toEqual(new Error('offline'));
      expect(await second).toEqual(new Error('offline'));
      expect(store.textSize).toBe(100);
      await store.load();
      expect(store.textSize).toBe(100);
    }
  );

  test('a delayed settings read preserves explicit values across an independent save', async () => {
    const store = await persistentStore();
    const originalGet = mockGetSettings.getMockImplementation();
    let finishRead: () => void;
    mockGetSettings.mockImplementationOnce(async () => {
      await new Promise<void>(resolve => {
        finishRead = resolve;
      });
      return originalGet();
    });
    const text = store.update({ textSize: 130 });
    await flush();
    await store.update({ contentWidth: 1800 });
    finishRead();
    await text;
    expect([store.textSize, store.contentWidth]).toEqual([130, 1800]);
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([130, 1800]);
  });

  test('failed update rejects and rolls back only the changed appearance values', async () => {
    const store = await persistentStore();
    await store.update({ contentWidth: 1200 });
    mockPost.mockRejectedValue(new Error('offline'));
    await expect(store.update({ textSize: 130 })).rejects.toThrow('offline');
    expect([store.textSize, store.contentWidth]).toEqual([100, 1200]);
  });
});

describe('layout draft controls', () => {
  let LayoutSettings;
  beforeAll(() => {
    LayoutSettings = require('~/views/settings/LayoutSettings.vue').default;
  });
  test('exposes bounded labelled numeric controls, keeps drafts unsaved, then saves independently', async () => {
    const store = await persistentStore();
    await store.update({ contentWidth: 1800 });
    const wrapper = mount(LayoutSettings as any);
    const text = wrapper.find('#layout-text-size');
    const width = wrapper.find('#layout-content-width');
    expect(text.attributes()).toMatchObject({ type: 'number', min: '80', max: '150', step: '1' });
    expect(width.attributes()).toMatchObject({
      type: 'number',
      min: '600',
      max: '2400',
      step: '1',
    });
    expect(wrapper.find('label[for="layout-text-size"]').exists()).toBe(true);
    expect(wrapper.find('label[for="layout-content-width"]').exists()).toBe(true);
    await text.setValue('125');
    expect(store.textSize).toBe(100);
    await wrapper.find('form').trigger('submit');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([125, 1800]);
    expect(wrapper.find('[role="status"]').text()).toContain('saved');
    wrapper.destroy();
  });

  test.each(['textSize', 'contentWidth'])(
    'saving one draft preserves %s saved by another tab',
    async remoteKey => {
      const store = await persistentStore();
      const wrapper = mount(LayoutSettings as any);
      const remoteValue = remoteKey === 'textSize' ? 140 : 1800;
      const server = { ...store.$state, [remoteKey]: remoteValue };
      mockGetSettings.mockImplementation(async () => ({ ...server }));
      mockPost.mockImplementation(async (url, value) => {
        server[url.split('/').pop()] = value;
      });
      if (remoteKey === 'textSize') {
        await wrapper.find('#layout-automatic-width').setChecked(false);
        await wrapper.find('#layout-content-width').setValue('2100');
      } else {
        await wrapper.find('#layout-text-size').setValue('125');
      }
      await wrapper.find('form').trigger('submit');
      await flush();
      expect(server[remoteKey]).toBe(remoteValue);
      expect(store[remoteKey]).toBe(remoteValue);
      expect([store.textSize, store.contentWidth]).toEqual(
        remoteKey === 'textSize' ? [140, 2100] : [125, 1800]
      );
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find('[role="status"]').text()).toContain('saved');
      wrapper.destroy();
    }
  );

  test('does not claim submitted values were saved when another writer wins the final reload', async () => {
    const store = await persistentStore();
    const wrapper = mount(LayoutSettings as any);
    mockPost.mockImplementation(async () => {
      mockGetSettings.mockResolvedValue({ textSize: 140, contentWidth: 0 });
    });
    await wrapper.find('#layout-text-size').setValue('130');
    await wrapper.find('form').trigger('submit');
    await flush();
    expect(store.textSize).toBe(140);
    expect((wrapper.find('#layout-text-size').element as HTMLInputElement).value).toBe('140');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(wrapper.find('[role="alert"]').text()).toContain('changed elsewhere');
    wrapper.destroy();
  });

  test('rejects out-of-range drafts without saving and resets both persisted values', async () => {
    const store = await persistentStore();
    await store.update({ textSize: 150, contentWidth: 2400 });
    const wrapper = mount(LayoutSettings as any);
    await wrapper.find('#layout-text-size').setValue('151');
    mockPost.mockClear();
    await wrapper.find('form').trigger('submit');
    await flush();
    expect(mockPost).not.toHaveBeenCalled();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    await wrapper.find('[data-testid="layout-reset"]').trigger('click');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
    wrapper.destroy();
  });

  test('explicit width saves without changing text, and Automatic restores route defaults', async () => {
    const store = await persistentStore();
    await store.update({ textSize: 140 });
    const wrapper = mount(LayoutSettings as any);
    await wrapper.find('#layout-automatic-width').setChecked(false);
    await wrapper.find('#layout-content-width').setValue('2100');
    await wrapper.find('form').trigger('submit');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([140, 2100]);
    await wrapper.find('#layout-automatic-width').setChecked(true);
    await wrapper.find('form').trigger('submit');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([140, 0]);
    wrapper.destroy();
  });

  test('does not report success while a request is pending, or after a draft changes', async () => {
    const store = await persistentStore();
    const wrapper = mount(LayoutSettings as any);
    let finish;
    const originalPost = mockPost.getMockImplementation();
    mockPost.mockImplementation(async (...args) => {
      await new Promise(resolve => {
        finish = resolve;
      });
      return originalPost(...args);
    });
    await wrapper.find('#layout-text-size').setValue('110');
    await wrapper.find('form').trigger('submit');
    await flush();
    expect(wrapper.find('fieldset').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    finish();
    await flush();
    expect(store.textSize).toBe(110);
    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    await wrapper.find('#layout-text-size').setValue('120');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    wrapper.destroy();
  });

  test('a partially rejected save restores both applied values and warns about server uncertainty', async () => {
    const store = await persistentStore();
    const wrapper = mount(LayoutSettings as any);
    const originalPost = mockPost.getMockImplementation();
    mockPost.mockImplementation((url, ...args) => {
      if (url.endsWith('/contentWidth')) return Promise.reject(new Error('offline'));
      return originalPost(url, ...args);
    });
    await wrapper.find('#layout-text-size').setValue('130');
    await wrapper.find('#layout-automatic-width').setChecked(false);
    await wrapper.find('#layout-content-width').setValue('1800');
    await wrapper.find('form').trigger('submit');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
    expect(wrapper.find('[role="alert"]').text()).toContain('may have reached the server');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    wrapper.destroy();
  });

  test.each(['textSize', 'contentWidth'])(
    'retry explicitly restores %s to its rolled-back value after a partial save',
    async revertedKey => {
      const store = await persistentStore();
      const wrapper = mount(LayoutSettings as any);
      const originalPost = mockPost.getMockImplementation();
      let calls = 0;
      mockPost.mockImplementation((url, ...args) => {
        if (++calls === 2) return Promise.reject(new Error('offline'));
        return originalPost(url, ...args);
      });
      await wrapper.find('#layout-text-size').setValue('130');
      await wrapper.find('#layout-automatic-width').setChecked(false);
      await wrapper.find('#layout-content-width').setValue('1800');
      await wrapper.find('form').trigger('submit');
      await flush();
      expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
      expect(wrapper.find('[role="alert"]').exists()).toBe(true);
      if (revertedKey === 'textSize') {
        await wrapper.find('#layout-text-size').setValue('100');
      } else {
        await wrapper.find('#layout-automatic-width').setChecked(true);
      }
      mockPost.mockImplementation(originalPost);
      await wrapper.find('form').trigger('submit');
      await flush();
      const expected = revertedKey === 'textSize' ? [100, 1800] : [130, 0];
      expect([store.textSize, store.contentWidth]).toEqual(expected);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find('[role="status"]').text()).toContain('saved');
      await store.load();
      expect([store.textSize, store.contentWidth]).toEqual(expected);
      wrapper.destroy();
    }
  );

  test('partially rejected reset restores the applied layout without claiming success', async () => {
    const store = await persistentStore();
    await store.update({ textSize: 150, contentWidth: 2400 });
    const wrapper = mount(LayoutSettings as any);
    const originalPost = mockPost.getMockImplementation();
    mockPost.mockImplementation((url, ...args) => {
      if (url.endsWith('/contentWidth')) return Promise.reject(new Error('offline'));
      return originalPost(url, ...args);
    });
    await wrapper.find('[data-testid="layout-reset"]').trigger('click');
    await flush();
    expect([store.textSize, store.contentWidth]).toEqual([150, 2400]);
    expect(wrapper.find('[role="alert"]').text()).toContain('may have reached the server');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    // The backend is per-key, not transactional: text did reach the server.
    await store.load();
    expect([store.textSize, store.contentWidth]).toEqual([100, 2400]);
    wrapper.destroy();
  });

  test.each([false, true])(
    'Save retries the defaults after a failed reset (partial writes: %s)',
    async partialWrites => {
      const store = await persistentStore();
      await store.update({ textSize: 150, contentWidth: 2400 });
      const wrapper = mount(LayoutSettings as any);
      const originalPost = mockPost.getMockImplementation();
      mockPost.mockImplementation((url, ...args) => {
        if (!partialWrites || url.endsWith('/contentWidth')) {
          return Promise.reject(new Error('offline'));
        }
        return originalPost(url, ...args);
      });
      await wrapper.find('[data-testid="layout-reset"]').trigger('click');
      await flush();
      expect([store.textSize, store.contentWidth]).toEqual([150, 2400]);
      expect(wrapper.find('[role="alert"]').text()).toContain('Could not save');
      expect(wrapper.find('[role="status"]').exists()).toBe(false);
      expect((wrapper.find('#layout-text-size').element as HTMLInputElement).value).toBe('100');
      expect((wrapper.find('#layout-automatic-width').element as HTMLInputElement).checked).toBe(
        true
      );
      expect(wrapper.find('#layout-content-width').attributes('disabled')).toBeDefined();

      mockPost.mockImplementation(originalPost);
      await wrapper.find('form').trigger('submit');
      await flush();
      expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
      expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      expect(wrapper.find('[role="status"]').text()).toContain('saved');
      await store.load();
      expect([store.textSize, store.contentWidth]).toEqual([100, 0]);
      wrapper.destroy();
    }
  );

  test('new layout messages use English fallback in another locale', () => {
    expect(i18n.t('settings.layout.textSize', 'sv')).toBe('Text size (%)');
  });

  test('shows a save error, no success and restores applied layout while retaining retryable drafts', async () => {
    const store = await persistentStore();
    const wrapper = mount(LayoutSettings as any);
    await wrapper.find('#layout-text-size').setValue('130');
    mockPost.mockRejectedValue(new Error('offline'));
    await wrapper.find('form').trigger('submit');
    await flush();
    expect(wrapper.find('[role="alert"]').text()).toContain('Could not save');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
    expect(store.textSize).toBe(100);
    expect((wrapper.find('#layout-text-size').element as HTMLInputElement).value).toBe('130');
    wrapper.destroy();
  });
});

describe('applied layout', () => {
  test.each([false, true])(
    'preserves route fullContainer=%s and applies only a bounded container override',
    async fullContainer => {
      const store = await persistentStore();
      document.documentElement.style.setProperty('font-size', '17px', 'important');
      const wrapper = shallowMount(App as any, {
        mocks: { $route: { meta: { fullContainer } } },
        stubs: [
          'aw-header',
          'aw-footer',
          'error-boundary',
          'user-satisfaction-poll',
          'new-release-notification',
          'router-view',
        ],
      });
      await flush();
      const container = wrapper.find('.aw-content');
      expect(container.classes()).toContain(fullContainer ? 'container-fluid' : 'container');
      expect((container.element as HTMLElement).style.maxWidth).toBe('');
      store.$patch({ textSize: 150, contentWidth: 1800 });
      await Vue.nextTick();
      expect(document.documentElement.style.fontSize).toBe('150%');
      expect((container.element as HTMLElement).style.maxWidth).toBe('1800px');
      expect((container.element as HTMLElement).style.width).toBe('100%');
      expect(wrapper.attributes('style')).toBeUndefined();
      store.$patch({ contentWidth: 0 });
      await Vue.nextTick();
      expect((container.element as HTMLElement).style.maxWidth).toBe('');
      wrapper.destroy();
      expect(document.documentElement.style.fontSize).toBe('17px');
      expect(document.documentElement.style.getPropertyPriority('font-size')).toBe('important');
      store.$patch({ textSize: 80 });
      await Vue.nextTick();
      expect(document.documentElement.style.fontSize).toBe('17px');
      document.documentElement.style.removeProperty('font-size');
    }
  );
});
