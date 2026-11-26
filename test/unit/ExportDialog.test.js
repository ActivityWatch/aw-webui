import { shallowMount } from '@vue/test-utils';
import ExportDialog from '~/components/ExportDialog.vue';

// Like BModal for the dialog: its props, its slot, its events.
const BModal = {
  name: 'BModal',
  props: ['visible', 'title', 'okTitle', 'okDisabled', 'cancelTitle', 'centered'],
  template: '<div class="modal-stub"><slot /></div>',
};

const mountDialog = (propsData = {}) =>
  shallowMount(ExportDialog, {
    propsData: { visible: true, ...propsData },
    mocks: { $t: (key, args) => (args ? `${key} ${JSON.stringify(args)}` : key) },
    stubs: {
      'b-modal': BModal,
      'b-form-group': true,
      'b-form-radio-group': true,
      'b-alert': true,
    },
  });

const modal = wrapper => wrapper.findComponent(BModal);
const warnings = wrapper =>
  wrapper.findAll('b-alert-stub').filter(a => a.text() === 'ui.timeInterval.invalidRange');

describe('ExportDialog', () => {
  test('a bucket: its name in the title, JSON or CSV', () => {
    const wrapper = mountDialog({ bucketId: 'aw-watcher-window_host' });
    expect(modal(wrapper).props('title')).toBe(
      'buckets.exportBucketTitle {"bucket":"aw-watcher-window_host"}'
    );
    expect(wrapper.find('b-form-radio-group-stub').exists()).toBe(true);
    expect(wrapper.vm.formats.map(f => f.value)).toEqual(['json', 'csv']);
  });

  test('all buckets: JSON only, no format choice', () => {
    const wrapper = mountDialog({ bucketId: null });
    expect(modal(wrapper).props('title')).toBe('buckets.exportAllTitle');
    expect(wrapper.find('b-form-radio-group-stub').exists()).toBe(false);
    wrapper.setData({ format: 'csv' }); // cannot be chosen, and ignored anyway
    wrapper.vm.submit();
    expect(wrapper.emitted('export')).toEqual([
      [{ format: 'json', from: '', to: '', fromTime: '', toTime: '' }],
    ]);
  });

  test('offers the last range again each time it opens, JSON first', () => {
    const wrapper = mountDialog({
      bucketId: 'b',
      initialFrom: '2026-10-26',
      initialTo: '2026-10-30',
      initialFromTime: '09:00',
    });
    wrapper.setData({ from: 'x', to: 'y', fromTime: '01:00', toTime: '02:00', format: 'csv' });
    wrapper.vm.reset(); // @show
    expect(wrapper.vm.$data).toEqual({
      from: '2026-10-26',
      to: '2026-10-30',
      fromTime: '09:00',
      toTime: '',
      format: 'json',
    });
  });

  test('exports the chosen range and format', async () => {
    const wrapper = mountDialog({ bucketId: 'b' });
    await wrapper.setData({ from: '2026-10-26', to: '2026-10-30', format: 'csv' });
    expect(modal(wrapper).props('okDisabled')).toBe(false);
    wrapper.vm.submit();
    expect(wrapper.emitted('export')).toEqual([
      [{ format: 'csv', from: '2026-10-26', to: '2026-10-30', fromTime: '', toTime: '' }],
    ]);
  });

  test('CSV takes optional times; JSON takes whole days', async () => {
    const wrapper = mountDialog({ bucketId: 'b' });
    const range = () => wrapper.findComponent({ name: 'InputDateRange' });
    expect(range().props('allowTime')).toBe(false);
    await wrapper.setData({
      from: '2026-10-26',
      fromTime: '09:00',
      toTime: '17:30',
      format: 'csv',
    });
    expect(range().props('allowTime')).toBe(true);
    wrapper.vm.submit();
    await wrapper.setData({ format: 'json' });
    expect(range().props('allowTime')).toBe(false);
    wrapper.vm.submit();
    expect(wrapper.emitted('export')).toEqual([
      [{ format: 'csv', from: '2026-10-26', to: '', fromTime: '09:00', toTime: '17:30' }],
      // The end time's day stays the end, as a whole day.
      [{ format: 'json', from: '2026-10-26', to: '2026-10-26', fromTime: '', toTime: '' }],
    ]);
  });

  test('JSON keeps the day an end time without an end date refers to', async () => {
    const wrapper = mountDialog({ bucketId: 'b' });
    await wrapper.setData({ from: '2026-10-26', toTime: '17:30', format: 'json' });
    wrapper.vm.submit();
    expect(wrapper.emitted('export')).toEqual([
      [{ format: 'json', from: '2026-10-26', to: '2026-10-26', fromTime: '', toTime: '' }],
    ]);
  });

  test('a remembered start date can be cleared to export the whole history', async () => {
    const wrapper = mountDialog({ bucketId: 'b', initialFrom: '2026-10-26' });
    wrapper.vm.reset(); // @show
    const range = wrapper.findComponent({ name: 'InputDateRange' });
    expect(range.props('clearableStart')).toBe(true);
    range.vm.$emit('update:start', ''); // the start picker's reset button
    wrapper.vm.submit();
    expect(wrapper.emitted('export')).toEqual([
      [{ format: 'json', from: '', to: '', fromTime: '', toTime: '' }],
    ]);
  });

  test('all buckets never offers times', async () => {
    const wrapper = mountDialog({ bucketId: null });
    await wrapper.setData({ format: 'csv' });
    expect(wrapper.findComponent({ name: 'InputDateRange' }).props('allowTime')).toBe(false);
  });

  test('a CSV end time before its start time on the same day is invalid', async () => {
    const wrapper = mountDialog({ bucketId: 'b' });
    await wrapper.setData({
      from: '2026-10-26',
      to: '2026-10-26',
      fromTime: '17:00',
      toTime: '09:00',
      format: 'csv',
    });
    expect(warnings(wrapper).length).toBe(1);
    expect(modal(wrapper).props('okDisabled')).toBe(true);
    // The same times are ignored for JSON, which exports the whole day.
    await wrapper.setData({ format: 'json' });
    expect(modal(wrapper).props('okDisabled')).toBe(false);
  });

  test('a CSV time with no date to apply to is refused, not ignored', async () => {
    const wrapper = mountDialog({ bucketId: 'b' });
    await wrapper.setData({ format: 'csv' });
    for (const orphan of [
      { toTime: '17:30' },
      { fromTime: '09:00' },
      { to: '2026-10-30', fromTime: '09:00' },
    ]) {
      await wrapper.setData({ from: '', to: '', fromTime: '', toTime: '', ...orphan });
      expect(modal(wrapper).props('okDisabled')).toBe(true);
      wrapper.vm.submit();
    }
    expect(wrapper.emitted('export')).toBeUndefined();
    // The start date is also the day of an end time.
    await wrapper.setData({ from: '2026-10-26', to: '', fromTime: '', toTime: '17:30' });
    expect(modal(wrapper).props('okDisabled')).toBe(false);
    // JSON hides the times, so a left-over one does not block it.
    await wrapper.setData({ from: '', format: 'json' });
    expect(modal(wrapper).props('okDisabled')).toBe(false);
  });

  test('"From" after "To": the warning of the Timeline, Export greyed, nothing exported', async () => {
    const wrapper = mountDialog({ bucketId: 'b' });
    await wrapper.setData({ from: '2026-10-30', to: '2026-10-26' });
    expect(warnings(wrapper).length).toBe(1);
    expect(modal(wrapper).props('okDisabled')).toBe(true);
    const event = { preventDefault: jest.fn() };
    wrapper.vm.submit(event); // e.g. Enter in a field
    expect(event.preventDefault).toHaveBeenCalled();
    expect(wrapper.emitted('export')).toBeUndefined();
  });

  test('equal "From" and "To", or one side empty, are accepted', async () => {
    const wrapper = mountDialog({ bucketId: 'b' });
    for (const [from, to] of [
      ['2026-10-30', '2026-10-30'],
      ['2026-10-30', ''],
      ['', '2026-10-26'],
    ]) {
      await wrapper.setData({ from, to });
      expect(warnings(wrapper).length).toBe(0);
      expect(modal(wrapper).props('okDisabled')).toBe(false);
    }
  });

  test('the dates are the date fields of the Timeline', async () => {
    const wrapper = mountDialog({ bucketId: 'b' });
    const range = wrapper.findComponent({ name: 'InputDateRange' });
    expect(range.exists()).toBe(true);
    range.vm.$emit('update:start', '2026-10-26');
    range.vm.$emit('update:end', '2026-10-30');
    expect(wrapper.vm.$data).toMatchObject({ from: '2026-10-26', to: '2026-10-30' });
  });

  test('closing it tells the page', () => {
    const wrapper = mountDialog({ bucketId: 'b' });
    modal(wrapper).vm.$emit('hidden');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });
});
