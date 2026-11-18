import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import InputDate from '~/components/InputDate.vue';

const DatepickerStub = {
  name: 'b-form-datepicker',
  props: ['value', 'startWeekday'],
  render(h) {
    return h('div');
  },
};

function make() {
  return mount(InputDate as any, {
    propsData: { value: '2026-06-10' },
    stubs: { 'b-form-datepicker': DatepickerStub },
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
