import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import InputDate from '~/components/InputDate.vue';
import fr from '~/i18n/locales/fr';

const DatepickerStub = {
  name: 'b-form-datepicker',
  props: ['value', 'startWeekday', 'labelNoDateSelected', 'labelResetButton', 'labelNav'],
  render(h) {
    return h('div');
  },
};

function make(mocks?: Record<string, unknown>) {
  return mount(InputDate as any, {
    propsData: { value: '2026-06-10' },
    stubs: { 'b-form-datepicker': DatepickerStub },
    mocks,
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
});

test.each([
  ['Monday', 1],
  ['Sunday', 0],
  ['Saturday', 6],
])('starts the calendar week on %s', async (startOfWeek, weekday) => {
  useSettingsStore().$patch({ startOfWeek });
  const wrapper = make();
  try {
    expect(wrapper.findComponent(DatepickerStub).props('startWeekday')).toBe(weekday);
  } finally {
    wrapper.destroy();
  }
});

test('follows changes to the setting', async () => {
  const settings = useSettingsStore();
  settings.$patch({ startOfWeek: 'Sunday' });
  const wrapper = make();
  try {
    settings.$patch({ startOfWeek: 'Monday' });
    await wrapper.vm.$nextTick();
    expect(wrapper.findComponent(DatepickerStub).props('startWeekday')).toBe(1);
  } finally {
    wrapper.destroy();
  }
});

test('re-emits picked dates as input and change', async () => {
  const wrapper = make();
  try {
    wrapper.findComponent(DatepickerStub).vm.$emit('input', '2026-06-12');
    expect(wrapper.emitted('input')).toEqual([['2026-06-12']]);
    expect(wrapper.emitted('change')).toEqual([['2026-06-12']]);
  } finally {
    wrapper.destroy();
  }
});

test('passes translated labels instead of bootstrap-vue English defaults', () => {
  const wrapper = make();
  try {
    const picker = wrapper.findComponent(DatepickerStub);
    // jest-setup's $t resolves keys against en.ts; an unbound label is undefined.
    expect(picker.props('labelNoDateSelected')).toBe('No date selected');
    expect(picker.props('labelResetButton')).toBe('Reset');
    expect(picker.props('labelNav')).toBe('Calendar navigation');
  } finally {
    wrapper.destroy();
  }
});

test('takes the labels from the active locale, not English', () => {
  // The global $t stub in jest-setup resolves against en.ts, so pass a French
  // $t here: a component that hard-coded the English defaults would still pass
  // the test above but fail this one.
  const $t = (key: string) =>
    (key.split('.').reduce<any>((o, k) => (o == null ? null : o[k]), fr) as string | null) ?? key;
  const wrapper = make({ $t });
  try {
    const picker = wrapper.findComponent(DatepickerStub);
    expect(picker.props('labelResetButton')).toBe('Réinitialiser');
    expect(picker.props('labelNav')).toBe('Navigation du calendrier');
    expect(picker.props('labelNoDateSelected')).toBe('Aucune date sélectionnée');
  } finally {
    wrapper.destroy();
  }
});
