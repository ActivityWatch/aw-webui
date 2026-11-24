import { createLocalVue, mount } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import { createTestingPinia } from '@pinia/testing';
import { PiniaVuePlugin } from 'pinia';
import DaystartSettings from '~/views/settings/DaystartSettings.vue';
import { useSettingsStore } from '~/stores/settings';

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);
localVue.use(BootstrapVue);

// ActivityWatch/aw-webui#1328 (lower impact): clearing the time input saved
// startOfDay: '', which renders hour labels as "NaN".
describe('DaystartSettings start of day', () => {
  function mountSettings() {
    const pinia = createTestingPinia({ createSpy: jest.fn });
    const settings = useSettingsStore();
    settings.$patch({ startOfDay: '04:00' });
    const wrapper: any = mount(DaystartSettings, {
      localVue,
      pinia,
      mocks: { $t: (key: string) => key },
    });
    return { wrapper, settings };
  }

  // Driving the real input, so removing the change listener or the :key reset
  // makes this fail instead of passing on a direct state write.
  function timeInput(wrapper: any): HTMLInputElement {
    return wrapper.find('input[type="time"]').element as HTMLInputElement;
  }

  async function typeInto(wrapper: any, value: string) {
    const input = timeInput(wrapper);
    input.value = value;
    await wrapper.find('input[type="time"]').trigger('change');
    await wrapper.vm.$nextTick();
  }

  test('clearing the input is not saved and it shows the stored time again', async () => {
    const { wrapper, settings } = mountSettings();
    expect(timeInput(wrapper).value).toBe('04:00');

    await typeInto(wrapper, '');

    expect(settings.update).not.toHaveBeenCalled();
    expect(timeInput(wrapper).value).toBe('04:00');
  });

  test('a valid time is saved', async () => {
    const { wrapper, settings } = mountSettings();
    await typeInto(wrapper, '05:30');
    expect(settings.update).toHaveBeenCalledWith({ startOfDay: '05:30' });
  });
});
