import { createLocalVue, shallowMount } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { PiniaVuePlugin } from 'pinia';
import DaystartSettings from '~/views/settings/DaystartSettings.vue';
import { useSettingsStore } from '~/stores/settings';

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);

// ActivityWatch/aw-webui#1328 (lower impact): clearing the time input saved
// startOfDay: '', which renders hour labels as "NaN".
describe('DaystartSettings start of day', () => {
  function mountSettings() {
    const pinia = createTestingPinia({ createSpy: jest.fn });
    const settings = useSettingsStore();
    settings.$patch({ startOfDay: '04:00' });
    const wrapper: any = shallowMount(DaystartSettings, {
      localVue,
      pinia,
      mocks: { $t: (key: string) => key },
    });
    return { wrapper, settings };
  }

  test('an empty value is not saved and the input resets to the stored time', async () => {
    const { wrapper, settings } = mountSettings();
    const key = wrapper.vm.startOfDayInputKey;
    wrapper.vm.startOfDay = '';
    expect(settings.update).not.toHaveBeenCalled();
    expect(wrapper.vm.startOfDayInputKey).toBe(key + 1);
    expect(wrapper.vm.startOfDay).toBe('04:00');
  });

  test('a valid time is saved', () => {
    const { wrapper, settings } = mountSettings();
    wrapper.vm.startOfDay = '05:30';
    expect(settings.update).toHaveBeenCalledWith({ startOfDay: '05:30' });
  });
});
