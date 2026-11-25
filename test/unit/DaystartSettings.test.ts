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

  // Driving the real input, so removing the change/blur listeners or the :key reset
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

  test('clearing a segment mid-edit is not saved and does not remount the input', async () => {
    const { wrapper, settings } = mountSettings();
    const before = timeInput(wrapper);
    expect(before.value).toBe('04:00');

    // Browsers emit change with '' as soon as a segment is blanked; the user is
    // still typing, so the same element must stay mounted with focus.
    await typeInto(wrapper, '');

    expect(settings.update).not.toHaveBeenCalled();
    expect(timeInput(wrapper)).toBe(before);
  });

  test('leaving the input empty shows the stored time again on blur', async () => {
    const { wrapper, settings } = mountSettings();
    await typeInto(wrapper, '');

    await wrapper.find('input[type="time"]').trigger('blur');
    await wrapper.vm.$nextTick();

    expect(settings.update).not.toHaveBeenCalled();
    expect(timeInput(wrapper).value).toBe('04:00');
  });

  test('blur after a valid edit keeps the input', async () => {
    const { wrapper } = mountSettings();
    await typeInto(wrapper, '05:30');
    const before = timeInput(wrapper);
    await wrapper.find('input[type="time"]').trigger('blur');
    await wrapper.vm.$nextTick();
    expect(timeInput(wrapper)).toBe(before);
  });

  test('a valid time is saved', async () => {
    const { wrapper, settings } = mountSettings();
    await typeInto(wrapper, '05:30');
    expect(settings.update).toHaveBeenCalledWith({ startOfDay: '05:30' });
  });
});
