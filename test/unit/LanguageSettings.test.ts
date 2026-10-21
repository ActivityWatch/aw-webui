import { createPinia, setActivePinia } from 'pinia';
import { shallowMount } from '@vue/test-utils';
import LanguageSettings from '~/views/settings/LanguageSettings.vue';
import { LANGUAGE_NAMES, SUPPORTED } from '~/i18n';
import { useSettingsStore } from '~/stores/settings';

describe('LanguageSettings', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('offers every supported locale, in order, by its endonym', () => {
    useSettingsStore().$patch({ _loaded: true });
    const wrapper = shallowMount(LanguageSettings as any, {
      global: {
        stubs: { 'b-form-select': { template: '<select><slot /></select>' } },
        mocks: { $t: (key: string) => key },
      },
    });

    const options = wrapper.findAll('option');
    expect(options.map(o => o.attributes('value'))).toEqual(SUPPORTED);
    expect(options.map(o => o.text())).toEqual(SUPPORTED.map(code => LANGUAGE_NAMES[code]));
  });
});
