import { shallowMount, createLocalVue } from '@vue/test-utils';
import EventList from '~/visualizations/EventList.vue';

const localVue = createLocalVue();
localVue.filter('friendlytime', v => String(v));
localVue.filter('friendlyduration', v => String(v));

function makeEvents(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    timestamp: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
    duration: 1,
    data: { title: `event ${i}` },
  }));
}

function mountList(n) {
  return shallowMount(EventList, {
    localVue,
    propsData: { events: makeEvents(n), bucket_id: 'test-bucket' },
    stubs: { 'b-card': true, 'b-button': true, 'b-btn': true, icon: true, 'event-editor': true },
  });
}

describe('EventList', () => {
  test('shows at most 100 events initially and offers a button for the rest', () => {
    const wrapper = mountList(250);
    expect(wrapper.vm.displayed_events).toHaveLength(100);
    expect(wrapper.find('.show-more').exists()).toBe(true);
  });

  test('showMore reveals the next page and hides the button once all events are shown', () => {
    const wrapper = mountList(250);
    wrapper.vm.showMore();
    expect(wrapper.vm.displayed_events).toHaveLength(200);
    wrapper.vm.showMore();
    expect(wrapper.vm.displayed_events).toHaveLength(250);
    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.find('.show-more').exists()).toBe(false);
    });
  });

  test('no show-more button for short lists', () => {
    expect(mountList(5).find('.show-more').exists()).toBe(false);
  });
});
