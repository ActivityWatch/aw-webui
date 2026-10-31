import { mount } from '@vue/test-utils';
import SelectableEventView from '~/components/SelectableEventView.vue';

const event = {
  timestamp: '2026-10-31T12:00:00Z',
  duration: 12,
  data: { title: 'Code', app: 'Vim' },
};

function mountView(events: unknown, vis_method = 'eventlist') {
  const wrapper: any = mount(SelectableEventView, {
    propsData: { events, event_type: 'currentwindow' },
    stubs: {
      'vis-timeline': true,
      'aw-eventlist': {
        name: 'EventListStub',
        props: ['events'],
        template: '<div class="eventlist-stub" />',
      },
      'aw-summary': true,
    },
  });
  if (vis_method !== wrapper.vm.vis_method) {
    wrapper.setData({ vis_method });
  }
  return wrapper;
}

describe('SelectableEventView result admission', () => {
  test('uses EventList for ordinary event arrays', async () => {
    const wrapper = mountView([event]);
    try {
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.eventlist-stub').exists()).toBe(true);
      expect(wrapper.find('pre.result-fallback').exists()).toBe(false);
    } finally {
      wrapper.destroy();
    }
  });

  test('keeps EventList for empty event arrays', async () => {
    const wrapper = mountView([]);
    try {
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.eventlist-stub').exists()).toBe(true);
      expect(wrapper.find('pre.result-fallback').exists()).toBe(false);
    } finally {
      wrapper.destroy();
    }
  });

  test.each([
    [42, '42'],
    [{ total: 42 }, '"total": 42'],
    [null, 'null'],
    [[1, 2], '1'],
    [[event, 1], '1'],
  ])('falls back to JSON for non-event result %p', async (value, snippet) => {
    const wrapper = mountView(value);
    try {
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.eventlist-stub').exists()).toBe(false);
      const fallback = wrapper.find('pre.result-fallback');
      expect(fallback.exists()).toBe(true);
      expect(fallback.text()).toContain(snippet);
    } finally {
      wrapper.destroy();
    }
  });

  test('Raw JSON still renders event arrays', async () => {
    const wrapper = mountView([event], 'raw');
    try {
      await wrapper.vm.$nextTick();
      expect(wrapper.find('.eventlist-stub').exists()).toBe(false);
      expect(wrapper.find('pre').exists()).toBe(true);
    } finally {
      wrapper.destroy();
    }
  });
});
