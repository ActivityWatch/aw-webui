import { shallowMount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ActivityView from '~/views/activity/ActivityView.vue';
import { useSettingsStore } from '~/stores/settings';
import { useViewsStore } from '~/stores/views';

const confirmed = [{ id: 'only', name: 'Only view', elements: [] }];
const copy = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

async function mountEditor(viewId = 'default') {
  const settings = useSettingsStore();
  settings.$patch({ _loaded: true, views: copy(confirmed) });
  const views = useViewsStore();
  await views.load();
  const persist = jest.spyOn(settings, 'save').mockResolvedValue(undefined);
  const replace = jest.fn();
  const wrapper = shallowMount(ActivityView, {
    propsData: { view_id: viewId },
    mocks: {
      $route: { params: {}, path: `/activity/view/${viewId}` },
      $router: { replace },
      $t: key => key,
    },
    data: () => ({ editing: true }),
    directives: { 'b-modal': () => undefined },
    stubs: {
      draggable: { template: '<div><slot /></div>' },
      'b-button': {
        template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>',
      },
      'b-alert': { props: ['show'], template: '<div v-if="show" role="alert"><slot /></div>' },
      'b-modal': true,
      'b-form-group': true,
      'b-form-input': true,
      'router-link': true,
      icon: true,
    },
  });
  const click = async (name: string) => {
    const button = wrapper.findAll('button').wrappers.find(b => b.text().includes(name));
    expect(button).toBeDefined();
    await button.trigger('click');
  };
  const remove = async () => {
    wrapper.findAll('b-modal-stub').at(0).vm.$emit('ok');
    await flush();
  };
  return { wrapper, settings, views, persist, replace, click, remove };
}

beforeEach(() => setActivePinia(createPinia()));
afterEach(() => jest.restoreAllMocks());

test.each(['default', 'only'])(
  'the last view deletion at %s remains saveable until confirmed',
  async viewId => {
    const { wrapper, settings, views, persist, click, remove } = await mountEditor(viewId);
    await remove();
    expect(views.views).toEqual([]);
    expect(settings.views).toEqual(confirmed);
    expect(persist).not.toHaveBeenCalled();
    let finish!: () => void;
    persist.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          finish = resolve;
        })
    );
    await click('activityView.save');
    await flush();
    expect(persist).toHaveBeenCalledTimes(1);
    expect(wrapper.find('button[variant="success"]').attributes('disabled')).toBeDefined();
    expect((wrapper.vm as any).editing).toBe(true);
    finish();
    await flush();
    expect(settings.views).toEqual([]);
    expect((wrapper.vm as any).editing).toBe(false);
    await views.load();
    expect(views.views).toEqual([]);
    wrapper.destroy();
  }
);

test('failed empty-layout persistence displays the error and allows retry', async () => {
  const { wrapper, settings, views, persist, click, remove } = await mountEditor();
  await remove();
  persist.mockRejectedValueOnce(new Error('offline'));
  await click('activityView.save');
  await flush();
  expect(wrapper.find('[role="alert"]').text()).toContain('offline');
  expect(settings.views).toEqual(confirmed);
  expect(views.views).toEqual([]);
  await click('activityView.save');
  await flush();
  expect(settings.views).toEqual([]);
  expect(persist).toHaveBeenCalledTimes(2);
  wrapper.destroy();
});

test('Cancel after deleting the last view restores the confirmed layout without writing', async () => {
  const { wrapper, views, persist, click, remove } = await mountEditor();
  await remove();
  await click('activityView.cancel');
  await flush();
  expect(views.views).toEqual(confirmed);
  expect(persist).not.toHaveBeenCalled();
  expect((wrapper.vm as any).editing).toBe(false);
  wrapper.destroy();
});

test('an empty draft still offers Restore defaults', async () => {
  const { wrapper, views, settings, click, remove } = await mountEditor();
  jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  await remove();
  await click('activityView.restoreDefaults');
  expect(views.views.length).toBeGreaterThan(0);
  expect(settings.views).toEqual(confirmed);
  wrapper.destroy();
});
