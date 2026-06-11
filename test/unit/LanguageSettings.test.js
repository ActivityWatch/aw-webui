import { shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import LanguageSettings from '~/views/settings/LanguageSettings.vue';
import { getLocale, installI18n, setLocale } from '~/i18n';
import { useSettingsStore } from '~/stores/settings';

installI18n();

describe('LanguageSettings', () => {
  beforeEach(() => {
    setLocale('en');
  });

  function mountLanguageSettings() {
    return shallowMount(LanguageSettings, {
      global: {
        plugins: [
          createTestingPinia({
            initialState: {
              settings: {
                _loaded: true,
              },
            },
            stubActions: true,
          }),
        ],
      },
      stubs: {
        'b-select': {
          template: '<select @change="$emit(\'change\', $event.target.value)"><slot /></select>',
        },
      },
    });
  }

  test('renders language options', () => {
    const wrapper = mountLanguageSettings();

    expect(wrapper.text()).toContain('Language');
    expect(wrapper.text()).toContain('English');
    expect(wrapper.text()).toContain('简体中文');
  });

  test('updates the display language when a locale is selected', async () => {
    const wrapper = mountLanguageSettings();
    const settingsStore = useSettingsStore();

    await wrapper.find('select').setValue('zh-CN');

    expect(settingsStore.update).toHaveBeenCalledWith({ language: 'zh-CN' });
    expect(getLocale()).toBe('zh-CN');
  });
});
