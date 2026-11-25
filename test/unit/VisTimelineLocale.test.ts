import moment from 'moment';
import { i18n, setAppLocale } from '~/i18n';
import { createLocalVue, mount } from '@vue/test-utils';
import { createPinia, setActivePinia, PiniaVuePlugin } from 'pinia';

// Kept in its own file: vis-timeline must be evaluated for the first time inside
// the test, which any static import of it elsewhere in the file would prevent.
// The esnext ESM build is not transformed by jest; the peer UMD build is the same
// library code, including the module-level moment.locale(navigator.languages) call.
jest.mock('vis-timeline/esnext', () =>
  jest.requireActual('vis-timeline/peer/umd/vis-timeline-graph2d.js')
);

jest.mock('vis-timeline/styles/vis-timeline-graph2d.css', () => ({}));

describe('vis-timeline locale (#1324)', () => {
  afterEach(() => setAppLocale('en'));

  test('renders translated axes and refreshes cached labels after a locale change', async () => {
    setAppLocale('de');
    // vis-timeline runs moment.locale(navigator.languages) when first evaluated.
    const { default: VisTimeline } = await import('~/visualizations/VisTimeline.vue');
    expect(moment.locale()).toBe('de');
    expect(moment('2026-03-02').format('MMMM')).toBe('März');
    // jsdom has no layout. Give the real renderer a viewport and label metrics.
    const width = jest
      .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockImplementation(function () {
        return this.classList.contains('vis-text') ? 50 : 800;
      });
    const height = jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(30);
    const localVue = createLocalVue();
    localVue.use(PiniaVuePlugin);
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(VisTimeline, {
      localVue,
      pinia,
      i18n,
      propsData: {
        buckets: [],
        categorizedEvents: [
          {
            timestamp: '2026-03-01T00:00:00Z',
            duration: 86400,
            data: { $category: ['Work'] },
          },
        ],
        showRowLabels: true,
        queriedInterval: [moment('2026-03-01'), moment('2026-04-01')],
      },
      stubs: { EventEditor: true },
    });
    try {
      await wrapper.vm.$nextTick();
      const vm = wrapper.vm as any;
      vm.timeline.setWindow(moment('2026-03-01').valueOf(), moment('2026-04-01').valueOf(), {
        animation: false,
      });
      await new Promise(requestAnimationFrame);
      vm.timeline.redraw();
      await new Promise(requestAnimationFrame);
      expect(
        wrapper
          .findAll('.vis-time-axis')
          .wrappers.map(axis => axis.text())
          .join(' ')
      ).toContain('März');
      expect(vm.groupData.get('__categorized__').content).toBe('Kategorisiert');
      const initialWindow = vm.timeline.getWindow();
      setAppLocale('en');
      await wrapper.vm.$nextTick();
      await new Promise(requestAnimationFrame);
      expect(vm.groupData.get('__categorized__').content).toBe('Categorized');
      expect(vm.timeline.getWindow()).toEqual(initialWindow);
      expect(
        wrapper
          .findAll('.vis-time-axis')
          .wrappers.map(axis => axis.text())
          .join(' ')
      ).toContain('March');
    } finally {
      wrapper.destroy();
      width.mockRestore();
      height.mockRestore();
    }
  });
});
