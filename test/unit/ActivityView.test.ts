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
