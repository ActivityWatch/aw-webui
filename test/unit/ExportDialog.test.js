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
    expect(wrapper.emitted('export')).toEqual([[{ format: 'json', from: '', to: '' }]]);
  });

  test('offers the last range again each time it opens, JSON first', () => {
    const wrapper = mountDialog({
      bucketId: 'b',
      initialFrom: '2026-10-26',
      initialTo: '2026-10-30',
    });
    wrapper.setData({ from: 'x', to: 'y', format: 'csv' });
    wrapper.vm.reset(); // @show
    expect(wrapper.vm.$data).toEqual({
      from: '2026-10-26',
      to: '2026-10-30',
      format: 'json',
    });
  });

  test('exports the chosen range and format', async () => {
    const wrapper = mountDialog({ bucketId: 'b' });
    await wrapper.setData({ from: '2026-10-26', to: '2026-10-30', format: 'csv' });
    expect(modal(wrapper).props('okDisabled')).toBe(false);
    wrapper.vm.submit();
    expect(wrapper.emitted('export')).toEqual([
      [{ format: 'csv', from: '2026-10-26', to: '2026-10-30' }],
    ]);
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
