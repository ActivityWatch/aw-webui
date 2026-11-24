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
  const saveNewView = jest.spyOn(views, 'saveNewView');
  const vm = form();
  await Activity.methods.handleSubmit.call(vm);
  expect(views.views).toEqual(initial);
  expect(saveNewView).not.toHaveBeenCalled();
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

test('New view persists the stored layout, not unsaved ActivityView edits, and keeps the draft', async () => {
  const update = jest.spyOn(useSettingsStore(), 'update').mockImplementation(async ({ views }) => {
    useSettingsStore().$patch({ views: copy(views) });
  });
  useViewsStore().views[0].name = 'Unsaved edit';
  const vm = form();
  await Activity.methods.handleSubmit.call(vm);
  const persisted = update.mock.calls[0][0].views;
  expect(persisted.map(v => v.name)).toEqual(['Summary', 'Custom']);
  expect(useSettingsStore().views[0].name).toBe('Summary');
  expect(useViewsStore().views.map(v => v.name)).toEqual(['Unsaved edit', 'Custom']);
});

test('an id kept only in saved settings (after Restore defaults) cannot be reused', async () => {
  const saved = [...copy(initial), { id: 'custom', name: 'Older custom', elements: [] }];
  useSettingsStore().$patch({ views: copy(saved) });
  const update = jest.spyOn(useSettingsStore(), 'update');
  const views = useViewsStore();
  views.restoreDefaults(); // unsaved: the draft no longer lists 'custom'
  expect(views.views.some(v => v.id === 'custom')).toBe(false);

  expect(views.isViewIdTaken('custom')).toBe(true);
  const vm: any = { viewsStore: views, new_view: { id: 'custom', name: 'Custom' }, $t: k => k };
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  expect(Activity.methods.checkFormValidity.call(vm)).toBe(false);
  expect(alertSpy).toHaveBeenCalledTimes(1);

  await expect(views.saveNewView({ id: 'custom', name: 'Custom', elements: [] })).rejects.toThrow(
    'already uses'
  );
  expect(update).not.toHaveBeenCalled();
  expect(useSettingsStore().views).toEqual(saved);
  expect(views.views.some(v => v.id === 'custom')).toBe(false);
});

// ActivityWatch/aw-webui#1328 item 3: the route maps view id "default" to the
// first view, so a view with that id could never be opened and its Remove
// deleted Summary instead.
test.each([
  ['default', false],
  ['custom', true],
])('checkFormValidity with view id %p returns %p', (id, expected) => {
  const vm: any = {
    viewsStore: useViewsStore(),
    new_view: { id, name: 'Custom' },
    $t: (key: string) => key,
  };
  const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  expect(Activity.methods.checkFormValidity.call(vm)).toBe(expected);
  expect(alertSpy).toHaveBeenCalledTimes(expected ? 0 : 1);
});
