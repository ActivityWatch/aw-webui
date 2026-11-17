import { mount } from '@vue/test-utils';
import InputTimeInterval from '~/components/InputTimeInterval.vue';

// Date-only behaviour must stay identical for Bucket.vue, which does not opt in
// to the optional time inputs.

const stubs = ['b-alert', 'b-form-radio-group', 'b-button', 'icon'];
const mocks = { $t: (key: string) => key };

function make(propsData: Record<string, unknown> = {}) {
  return mount(InputTimeInterval as any, { propsData, stubs, mocks });
}

function range(wrapper: any) {
  const [start, end] = wrapper.vm.value;
  return [start.format('YYYY-MM-DD HH:mm'), end.format('YYYY-MM-DD HH:mm')];
}

test('date-only inputs keep the inclusive-day range', async () => {
  const wrapper = make();
  try {
    await wrapper.setData({ mode: 'range', start: '2026-06-10', end: '2026-06-11' });
    expect(range(wrapper)).toEqual(['2026-06-10 00:00', '2026-06-12 00:00']);
    expect(wrapper.vm.hasTime).toBe(false);
    expect(wrapper.vm.unresolvableTime).toBe(false);
  } finally {
    wrapper.destroy();
  }
});

test('time inputs do not apply unless the consumer opts in', async () => {
  const wrapper = make();
  try {
    await wrapper.setData({
      mode: 'range',
      start: '2026-06-10',
      startTime: '09:30',
      end: '2026-06-10',
      endTime: '11:00',
    });
    // allowTime defaults to false, so the times are ignored.
    expect(wrapper.vm.hasTime).toBe(false);
    expect(range(wrapper)).toEqual(['2026-06-10 00:00', '2026-06-11 00:00']);
  } finally {
    wrapper.destroy();
  }
});

test('opted-in times give an exact sub-day interval', async () => {
  const wrapper = make({ allowTime: true });
  try {
    await wrapper.setData({
      mode: 'range',
      start: '2026-06-10',
      startTime: '09:30',
      end: '2026-06-10',
      endTime: '11:00',
    });
    expect(range(wrapper)).toEqual(['2026-06-10 09:30', '2026-06-10 11:00']);
    expect(wrapper.vm.invalidDaterange).toBe(false);
    expect(wrapper.vm.unresolvableTime).toBe(false);
  } finally {
    wrapper.destroy();
  }
});

test('a start time without an end date still covers one day', async () => {
  const wrapper = make({ allowTime: true });
  try {
    await wrapper.setData({ mode: 'range', start: '2026-06-10', startTime: '09:30' });
    expect(range(wrapper)).toEqual(['2026-06-10 09:30', '2026-06-11 00:00']);
  } finally {
    wrapper.destroy();
  }
});

test('an end before the start is rejected and never emitted', async () => {
  const wrapper = make({ allowTime: true });
  try {
    await wrapper.setData({
      mode: 'range',
      start: '2026-06-10',
      startTime: '11:00',
      end: '2026-06-10',
      endTime: '09:30',
    });
    expect(wrapper.vm.invalidDaterange).toBe(true);
    const emittedBefore = wrapper.emitted('input')?.length ?? 0;
    wrapper.vm.valueChanged();
    expect(wrapper.emitted('input')?.length ?? 0).toBe(emittedBefore);
  } finally {
    wrapper.destroy();
  }
});

test('a wall time that names no instant is reported, not silently resolved', async () => {
  const wrapper = make({ allowTime: true });
  try {
    // 25:00 is not a valid wall time, so wallTimeInstants returns no instant.
    await wrapper.setData({
      mode: 'range',
      start: '2026-06-10',
      startTime: '25:00',
      end: '2026-06-10',
      endTime: '11:00',
    });
    expect(wrapper.vm.unresolvableTime).toBe(true);
    expect(wrapper.vm.invalidDaterange).toBe(false);
    // The date-only range is still emitted so consumers never see null.
    expect(range(wrapper)).toEqual(['2026-06-10 00:00', '2026-06-11 00:00']);
    const emittedBefore = wrapper.emitted('input')?.length ?? 0;
    wrapper.vm.valueChanged();
    expect(wrapper.emitted('input')?.length ?? 0).toBe(emittedBefore);
  } finally {
    wrapper.destroy();
  }
});

test('maxDuration applies to the exact interval when times are set', async () => {
  const wrapper = make({ allowTime: true, maxDuration: 60 * 60 });
  try {
    await wrapper.setData({
      mode: 'range',
      start: '2026-06-10',
      startTime: '09:00',
      end: '2026-06-10',
      endTime: '11:00',
    });
    expect(wrapper.vm.daterangeTooLong).toBe(true);
    await wrapper.setData({ endTime: '09:30' });
    expect(wrapper.vm.daterangeTooLong).toBe(false);
  } finally {
    wrapper.destroy();
  }
});
