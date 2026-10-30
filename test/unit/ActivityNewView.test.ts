import ActivityComponent from '~/views/activity/Activity.vue';
import { createPinia, setActivePinia } from 'pinia';
import { useViewsStore } from '~/stores/views';
import { useSettingsStore } from '~/stores/settings';

const Activity: any = ActivityComponent;
const copy = value => JSON.parse(JSON.stringify(value));
const initial = [{ id: 'summary', name: 'Summary', elements: [{ type: 'top_apps' }] }];

function form() {
  const vm: any = {
    viewsStore: useViewsStore(),
    new_view: { id: 'custom', name: 'Custom' },
    newViewSaving: false,
    newViewError: '',
    checkFormValidity: jest.fn(() => true),
    $refs: { new_view: { hide: jest.fn() } },
    $nextTick: fn => Promise.resolve().then(fn),
  };
  Object.defineProperty(vm, 'viewSavePending', {
    get: () => Activity.computed.viewSavePending.call(vm),
  });
  return vm;
}

beforeEach(() => {
  setActivePinia(createPinia());
  useViewsStore().loadViews(copy(initial));
  const settings = useSettingsStore();
  settings.$patch({ views: copy(initial) });
  jest.spyOn(settings, 'ensureLoaded').mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

test('New view does not mutate a draft while another layout save is pending', async () => {
  const views = useViewsStore();
  views.saving = true;
  const save = jest.spyOn(views, 'save').mockResolvedValue(undefined);
  const vm = form();
  await Activity.methods.handleSubmit.call(vm);
  expect(views.views).toEqual(initial);
  expect(save).not.toHaveBeenCalled();
  expect(vm.$refs.new_view.hide).not.toHaveBeenCalled();
  expect(vm.new_view.name).toBe('Custom');
});

test('New view waits for persistence, blocks duplicates, and closes only on success', async () => {
  let resolve!: () => void;
  jest.spyOn(useSettingsStore(), 'update').mockImplementation(async ({ views }) => {
    await new Promise<void>(done => {
      resolve = done;
    });
    useSettingsStore().$patch({ views: copy(views) });
  });
  const vm = form();
  const submission = Activity.methods.handleSubmit.call(vm);
  expect(vm.newViewSaving).toBe(true);
  expect(vm.$refs.new_view.hide).not.toHaveBeenCalled();
  await Activity.methods.handleSubmit.call(vm);
  expect(useViewsStore().views.filter(v => v.id === 'custom')).toHaveLength(1);
  resolve();
  await submission;
  expect(useSettingsStore().views.map(v => v.id)).toEqual(['summary', 'custom']);
  expect(vm.$refs.new_view.hide).toHaveBeenCalledTimes(1);
  expect(vm.newViewSaving).toBe(false);
});

test('failed creation preserves the form, removes the unconfirmed insertion and permits retry', async () => {
  jest
    .spyOn(useSettingsStore(), 'update')
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementationOnce(async ({ views }) => {
      useSettingsStore().$patch({ views: copy(views) });
    });
  useViewsStore().views[0].name = 'Existing unsaved layout';
  const draft = copy(useViewsStore().views);
  const vm = form();
  await Activity.methods.handleSubmit.call(vm);
  expect(vm.$refs.new_view.hide).not.toHaveBeenCalled();
  expect(vm.newViewError).toBe('offline');
  expect(vm.new_view).toEqual({ id: 'custom', name: 'Custom' });
  expect(useViewsStore().views).toEqual(draft);
  expect(vm.newViewSaving).toBe(false);
  await Activity.methods.handleSubmit.call(vm);
  expect(vm.$refs.new_view.hide).toHaveBeenCalledTimes(1);
  expect(vm.newViewError).toBe('');
  expect(useSettingsStore().views.map(v => v.id)).toEqual(['summary', 'custom']);
});

test('navigation during creation does not undo a confirmed view when the modal unmounts', async () => {
  let resolve!: () => void;
  jest.spyOn(useSettingsStore(), 'update').mockImplementation(async ({ views }) => {
    await new Promise<void>(done => {
      resolve = done;
    });
    useSettingsStore().$patch({ views: copy(views) });
  });
  const vm = form();
  const submission = Activity.methods.handleSubmit.call(vm);
  vm.$refs = {};
  resolve();
  await submission;
  expect(useViewsStore().views.map(v => v.id)).toEqual(['summary', 'custom']);
  expect(vm.newViewError).toBe('');
});
