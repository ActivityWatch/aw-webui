import { h, reactive } from 'vue';
import { shallowMount } from '@vue/test-utils';
import ActivityView from '~/views/activity/ActivityView.vue';

const mockViews = reactive([
  { id: 'default', name: 'Default', elements: [{ type: 'top_apps', props: {} }] },
  { id: 'second', name: 'Second', elements: [{ type: 'top_bucket_data', props: {} }] },
  {
    id: 'multi',
    name: 'Multi',
    elements: [
      { type: 'top_apps', props: {} },
      { type: 'top_titles', props: {} },
    ],
  },
]);

jest.mock('~/stores/views', () => ({
  useViewsStore: () => ({
    viewsForHost: () => mockViews,
  }),
}));

describe('ActivityView isVisLarge', () => {
  test('treats wide visualizations as full-width cards', () => {
    expect(ActivityView.methods.isVisLarge({ type: 'sunburst_clock' })).toBe(true);
    expect(ActivityView.methods.isVisLarge({ type: 'vis_timeline' })).toBe(true);
    expect(ActivityView.methods.isVisLarge({ type: 'timeline_barchart' })).toBe(false);
    expect(ActivityView.methods.isVisLarge({ type: 'top_apps' })).toBe(false);
  });
});

describe('ActivityView custom visualization modal', () => {
  test('stays open when a required field is blank', async () => {
    const event = { preventDefault: jest.fn() };
    const vm = { customVisWatcherName: 'aw-watcher-window', customVisTitle: '   ' };

    await ActivityView.methods.onCustomVisConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});

// Visualizations keep local state — the Top Bucket Data picker holds its
// selected bucket, field and fetched events in `data` and fills them in
// `mounted`. Every view renders the same list at the same positions, so if a
// card is keyed by its index alone Vue reuses the instance from the previous
// view and the stale state comes along with it.
// See https://github.com/ActivityWatch/aw-webui/issues/935
describe('ActivityView view switching', () => {
  const passthroughStub = { template: '<div><slot /></div>' };

  // Records a line per aw-selectable-vis instance created, so we can tell a
  // reused instance (no new record) from a fresh one.
  let created;

  const visStub = {
    name: 'aw-selectable-vis',
    props: ['id', 'type', 'props', 'viewId', 'editable'],
    data() {
      // The type this instance was created for, to detect instance reuse
      return { createdType: this.type };
    },
    created() {
      created.push(`${this.viewId}:${this.id}:${this.type}`);
    },
    render() {
      return h('div', { class: 'vis', 'data-created': this.createdType, 'data-type': this.type });
    },
  };

  function mountView(view_id = 'default') {
    return shallowMount(ActivityView, {
      props: { view_id },
      global: {
        mocks: { $route: { params: {}, path: '/activity/view/default' }, $t: key => key },
        stubs: {
          // Renders the #item slot per element, keyed by item-key like vuedraggable does
          draggable: {
            props: ['modelValue', 'itemKey'],
            template: `<div>
              <template v-for="(el, i) in modelValue" :key="itemKey(el)">
                <slot name="item" :element="el" :index="i" />
              </template>
              <slot name="footer" />
            </div>`,
          },
          'aw-selectable-vis': visStub,
          // Globally registered in main.js, so not resolvable from a bare mount
          'b-button': passthroughStub,
          'b-modal': passthroughStub,
          icon: passthroughStub,
        },
      },
    });
  }

  beforeEach(() => {
    created = [];
  });

  test('creates a fresh visualization instance when switching views', async () => {
    const wrapper = mountView();
    expect(created).toEqual(['default:0:top_apps']);

    await wrapper.setProps({ view_id: 'second' });

    // Without the view id in the key this stays at one entry: Vue patches the
    // props of the instance already sitting at index 0 rather than rebuilding.
    expect(created).toEqual(['default:0:top_apps', 'second:0:top_bucket_data']);
    wrapper.unmount();
  });

  test('does not rebuild visualizations while staying on the same view', async () => {
    const wrapper = mountView();
    await wrapper.setProps({ view_id: 'default' });

    expect(created).toEqual(['default:0:top_apps']);
    wrapper.unmount();
  });

  test('keeps each visualization instance with its element when reordering', async () => {
    const wrapper = mountView('multi');
    mockViews[2].elements.reverse();
    await wrapper.vm.$nextTick();

    const vis = wrapper.findAll('.vis');
    expect(vis.map(v => v.attributes('data-type'))).toEqual(['top_titles', 'top_apps']);
    // Keyed by position, the instance created for top_apps would now render top_titles
    for (const v of vis) {
      expect(v.attributes('data-created')).toBe(v.attributes('data-type'));
    }
    wrapper.unmount();
  });
});
