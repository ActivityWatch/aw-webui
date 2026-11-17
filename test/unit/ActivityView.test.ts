import { shallowMount } from '@vue/test-utils';
import ActivityViewComponent from '~/views/activity/ActivityView.vue';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const ActivityView: any = ActivityViewComponent;

const mockViews = [
  { id: 'default', name: 'Default', elements: [{ type: 'top_apps', props: {} }] },
  { id: 'second', name: 'Second', elements: [{ type: 'top_bucket_data', props: {} }] },
];

const mockSave = jest.fn();
const mockLoad = jest.fn();

jest.mock('~/stores/views', () => ({
  useViewsStore: () => ({
    viewsForHost: () => mockViews,
    saving: false,
    isDefaultSummary: view => view?.id === 'summary',
    save: (...args) => mockSave(...args),
    load: (...args) => mockLoad(...args),
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

describe('ActivityView mobile presentation', () => {
  test('chart-first presentation is off during editing and for custom layouts', () => {
    const eligible = ActivityView.computed.mobileDefaultSummary;
    expect(eligible.call({ phoneViewport: true, editing: false, view: { id: 'summary' } })).toBe(
      true
    );
    expect(eligible.call({ phoneViewport: false, editing: false, view: { id: 'summary' } })).toBe(
      false
    );
    expect(eligible.call({ phoneViewport: true, editing: true, view: { id: 'summary' } })).toBe(
      false
    );
    expect(eligible.call({ phoneViewport: true, editing: false, view: { id: 'custom' } })).toBe(
      false
    );
    expect(eligible.call({ phoneViewport: true, editing: false, view: undefined })).toBe(false);
  });

  test('phone reading order puts the chart first without changing saved or editor order', () => {
    const elements = [
      { type: 'top_apps' },
      { type: 'top_categories' },
      { type: 'timeline_barchart' },
    ];
    const get = ActivityView.computed.elements.get;
    const phone = get.call({ mobileDefaultSummary: true, view: { elements } });
    expect(phone.map(el => el.type)).toEqual(['timeline_barchart', 'top_apps', 'top_categories']);
    expect(elements.map(el => el.type)).toEqual([
      'top_apps',
      'top_categories',
      'timeline_barchart',
    ]);
    expect(get.call({ mobileDefaultSummary: false, view: { elements } })).toBe(elements);
  });

  test.each([false, true])(
    'DOM follows viewport and editing; cleans up listener (legacy: %s)',
    async legacy => {
      const original = window.matchMedia;
      const add = jest.fn();
      const remove = jest.fn();
      const query = {
        matches: true,
        ...(legacy
          ? { addListener: add, removeListener: remove }
          : { addEventListener: add, removeEventListener: remove }),
      };
      window.matchMedia = jest.fn().mockReturnValue(query);
      const elements = [
        { type: 'top_apps' },
        { type: 'top_categories' },
        { type: 'timeline_barchart' },
      ];
      const wrapper = shallowMount(ActivityView, {
        computed: { view: () => ({ id: 'summary', elements }) },
        mocks: { $route: { params: {}, path: '/activity/view/summary' }, $t: key => key },
        stubs: {
          draggable: { props: ['disabled'], template: '<div><slot /></div>' },
          'aw-selectable-vis': {
            props: ['type', 'id'],
            template: '<div :data-type="type" :data-id="id" />',
          },
          'b-button': true,
          'b-modal': true,
          icon: true,
        },
      });
      try {
        await wrapper.vm.$nextTick();
        const order = () =>
          wrapper.findAll('[data-type]').wrappers.map(el => el.attributes('data-type'));
        expect(order()).toEqual(['timeline_barchart', 'top_apps', 'top_categories']);
        expect(wrapper.findAll('[data-id]').wrappers.map(el => el.attributes('data-id'))).toEqual([
          '2',
          '0',
          '1',
        ]);
        expect(wrapper.findComponent({ name: 'draggable' }).props('disabled')).toBe(true);
        const onChange = add.mock.calls[0][legacy ? 0 : 1];
        onChange({ matches: false });
        await wrapper.vm.$nextTick();
        expect(order()).toEqual(['top_apps', 'top_categories', 'timeline_barchart']);
        onChange({ matches: true });
        await wrapper.vm.$nextTick();
        expect(order()[0]).toBe('timeline_barchart');
        await wrapper.setData({ editing: true });
        expect(wrapper.findComponent({ name: 'draggable' }).props('disabled')).toBe(false);
        expect(order()).toEqual(['top_apps', 'top_categories', 'timeline_barchart']);
        expect(elements[0].type).toBe('top_apps');
        wrapper.destroy();
        expect(remove).toHaveBeenCalledWith(...add.mock.calls[0]);
      } finally {
        wrapper.destroy();
        window.matchMedia = original;
      }
    }
  );
});

describe('ActivityView visClass', () => {
  const visClass = el => ActivityView.methods.visClass.call(ActivityView.methods, el);

  test('without a chosen width, keeps the per-type layout', () => {
    expect(visClass({ type: 'top_apps', size: 3 })).toEqual(['col-md-6', 'col-lg-4']);
    expect(visClass({ type: 'vis_timeline' })).toEqual(['col-md-12', 'col-lg-12']);
    // Changing a default card's type keeps its stored size: 3; the timeline stays full width.
    expect(visClass({ type: 'sunburst_clock', size: 3 })).toEqual(['col-md-12', 'col-lg-12']);
  });

  test('a chosen width sets the cards per row on large screens', () => {
    expect(visClass({ type: 'top_apps', width: 1 })).toEqual(['col-md-12', 'col-lg-12']);
    expect(visClass({ type: 'top_apps', width: 2 })).toEqual(['col-md-6', 'col-lg-6']);
    expect(visClass({ type: 'vis_timeline', width: 3 })).toEqual(['col-md-6', 'col-lg-4']);
  });

  test('the fixed-size clock stays full width whatever is stored', () => {
    expect(visClass({ type: 'sunburst_clock', width: 3 })).toEqual(['col-md-12', 'col-lg-12']);
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
    created() {
      created.push(`${this.viewId}:${this.id}:${this.type}`);
    },
    render: h => h('div'),
  };

  function mountView() {
    return shallowMount(ActivityView, {
      propsData: { view_id: 'default' },
      mocks: { $route: { params: {}, path: '/activity/view/default' }, $t: key => key },
      stubs: {
        draggable: { template: '<div><slot /></div>' },
        'aw-selectable-vis': visStub,
        // Globally registered in main.js, so not resolvable from a bare mount
        'b-button': passthroughStub,
        'b-modal': passthroughStub,
        icon: passthroughStub,
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
    wrapper.destroy();
  });

  test('does not rebuild visualizations while staying on the same view', async () => {
    const wrapper = mountView();
    await wrapper.setProps({ view_id: 'default' });

    expect(created).toEqual(['default:0:top_apps']);
    wrapper.destroy();
  });
});

describe('ActivityView Save and Cancel completion', () => {
  const button = {
    template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
  };
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  function mountEditor(): ReturnType<typeof shallowMount> & { vm: any } {
    return shallowMount(ActivityView, {
      propsData: { view_id: 'default' },
      mocks: { $route: { params: {}, path: '/activity/view/default' }, $t: key => key },
      data: () => ({ editing: true }),
      stubs: {
        draggable: { template: '<div><slot /></div>' },
        'b-button': button,
        'b-alert': { props: ['show'], template: '<div v-if="show" role="alert"><slot /></div>' },
        'b-modal': true,
        icon: true,
      },
    });
  }

  beforeEach(() => {
    mockSave.mockReset();
    mockLoad.mockReset();
  });

  test('Save stays editing until persistence succeeds and prevents duplicate submissions', async () => {
    let resolve!: () => void;
    mockSave.mockReturnValue(
      new Promise<void>(done => {
        resolve = done;
      })
    );
    const wrapper = mountEditor();
    await wrapper.find('button[variant="success"]').trigger('click');
    expect(wrapper.vm.editing).toBe(true);
    expect(wrapper.find('button[variant="success"]').attributes('disabled')).toBeDefined();
    expect(
      wrapper
        .findAll('button')
        .wrappers.find(b => b.text().includes('activityView.cancel'))
        .attributes('disabled')
    ).toBeDefined();
    await wrapper.vm.save();
    expect(mockSave).toHaveBeenCalledTimes(1);
    resolve();
    await flush();
    expect(wrapper.vm.editing).toBe(false);
    wrapper.destroy();
  });

  test('a rejected Save stays retryable, reports the error, and a retry can succeed', async () => {
    mockSave.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const wrapper = mountEditor();
    await wrapper.find('button[variant="success"]').trigger('click');
    await flush();
    expect(wrapper.vm.editing).toBe(true);
    expect(wrapper.find('[role="alert"]').text()).toContain('offline');
    await wrapper.find('button[variant="success"]').trigger('click');
    await flush();
    expect(wrapper.vm.editing).toBe(false);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.destroy();
  });

  test('Cancel only exits editing once the confirmed layout has reloaded', async () => {
    let resolve!: () => void;
    mockLoad.mockReturnValue(
      new Promise<void>(done => {
        resolve = done;
      })
    );
    const wrapper = mountEditor();
    await wrapper
      .findAll('button')
      .wrappers.find(b => b.text().includes('activityView.cancel'))
      .trigger('click');
    expect(wrapper.vm.editing).toBe(true);
    resolve();
    await flush();
    expect(mockLoad).toHaveBeenCalledTimes(1);
    expect(wrapper.vm.editing).toBe(false);
    wrapper.destroy();
  });
});
