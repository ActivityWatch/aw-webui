import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SelectableVisualization from '~/components/SelectableVisualization.vue';
import { useActivityStore } from '~/stores/activity';

beforeEach(() => setActivePinia(createPinia()));

describe('day-only clock mounting', () => {
  test.each([
    [[3600000, 'milliseconds'], false],
    [[86400000, 'milliseconds'], false],
    [[1, 'day'], true],
  ])('period %p mounts clock: %p', (periodLength, expected) => {
    const store = useActivityStore();
    store.$patch({
      query_options: { timeperiod: { start: '2026-10-20T13:00:00Z', length: periodLength } },
      buckets: { loaded: true, afk: ['afk'], window: ['window'] },
    } as any);
    const wrapper = shallowMount(SelectableVisualization, {
      propsData: { type: 'sunburst_clock', editable: false },
      stubs: ['aw-sunburst-clock', 'b-alert', 'icon'],
    });
    expect(wrapper.find('aw-sunburst-clock-stub').exists()).toBe(expected);
    wrapper.destroy();
  });
});
