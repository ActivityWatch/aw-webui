import { createLocalVue, mount } from '@vue/test-utils';
import BootstrapVue, { BModal } from 'bootstrap-vue';
import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import QueryExplorerComponent from '~/views/QueryExplorer.vue';
import { useSettingsStore } from '~/stores/settings';
import { useCategoryStore } from '~/stores/categories';
import { buildSavedQuery } from '~/util/savedQueries';

const QueryExplorer: any = QueryExplorerComponent;
const localVue = createLocalVue();
localVue.use(BootstrapVue);

function deferred<T = boolean>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => (resolve = done));
  return { promise, resolve };
}

const a = { id: 'a', name: 'A', query_code: 'RETURN = "A";' };
const b = { id: 'b', name: 'B', query_code: 'RETURN = "B";' };

function context() {
  const confirmation = deferred();
  const persistence = deferred();
  const vm: any = {
    ...QueryExplorer.methods,
    $bvModal: { msgBoxConfirm: jest.fn(() => confirmation.promise) },
    savedQueries: [a, b],
    selected_saved_query_id: 'a',
    query_code: a.query_code,
    startdate: moment().subtract(2, 'days').format('YYYY-MM-DD'),
    enddate: moment().subtract(1, 'days').format('YYYY-MM-DD'),
    event_type: 'currentwindow',
    saved_query_error: '',
    saved_query_pending: false,
    saveQueryDraft: null,
    renameQueryTarget: null,
    persistSavedQueries: jest.fn(() => persistence.promise),
  };
  Object.defineProperty(vm, 'selectedSavedQuery', {
    get: () => vm.savedQueries.find(query => query.id === vm.selected_saved_query_id) || null,
  });
  return { vm, confirmation, persistence };
}

const event = () => ({ preventDefault: jest.fn() });

describe('saved-query invocation ownership', () => {
  test.each([true, false])(
    'delete confirmation keeps A target (confirmation=%s)',
    async accepted => {
      const { vm, confirmation, persistence } = context();
      const operation = vm.deleteSelectedQuery();
      vm.selected_saved_query_id = 'b';
      confirmation.resolve(accepted);
      await Promise.resolve();
      if (accepted) {
        expect(vm.persistSavedQueries).toHaveBeenCalledWith([b]);
        persistence.resolve(true);
      }
      await operation;
      expect(vm.selected_saved_query_id).toBe('b');
      if (!accepted) expect(vm.persistSavedQueries).not.toHaveBeenCalled();
    }
  );

  test.each([true, false])('delete completion preserves newer selection (success=%s)', async ok => {
    const { vm, confirmation, persistence } = context();
    const operation = vm.deleteSelectedQuery();
    confirmation.resolve(true);
    await Promise.resolve();
    vm.selected_saved_query_id = 'b';
    persistence.resolve(ok);
    await operation;
    expect(vm.selected_saved_query_id).toBe('b');
  });

  test('normal confirmed delete clears its still-current selection', async () => {
    const { vm, confirmation, persistence } = context();
    const operation = vm.deleteSelectedQuery();
    confirmation.resolve(true);
    persistence.resolve(true);
    await operation;
    expect(vm.selected_saved_query_id).toBe('');
  });

  test.each(['query_code', 'startdate', 'enddate', 'event_type', 'selection'])(
    'update snapshots matching A draft before confirmation: %s change',
    async field => {
      const { vm, confirmation, persistence } = context();
      const expected = buildSavedQuery({ ...vm, id: 'a', name: 'A' });
      const operation = vm.saveCurrentQuery();
      if (field === 'selection') {
        vm.selected_saved_query_id = 'b';
        vm.query_code = b.query_code;
      } else {
        vm[field] = field.includes('date') ? '2020-01-01' : 'changed';
      }
      confirmation.resolve(true);
      await Promise.resolve();
      expect(vm.persistSavedQueries).toHaveBeenCalledWith([expected, b]);
      vm.selected_saved_query_id = 'b';
      persistence.resolve(true);
      await operation;
      expect(vm.selected_saved_query_id).toBe('b');
    }
  );

  test('only one preset mutation can be operation, including confirmation', async () => {
    const { vm, confirmation } = context();
    const first = vm.deleteSelectedQuery();
    await vm.saveCurrentQuery();
    await vm.deleteSelectedQuery();
    await vm.renameSelectedQuery();
    expect(vm.$bvModal.msgBoxConfirm).toHaveBeenCalledTimes(1);
    expect(vm.showRenameQueryModal).not.toBe(true);
    confirmation.resolve(false);
    await first;
    expect(vm.saved_query_pending).toBe(false);
  });

  test('rename stays bound to the modal opening target after selection changes', async () => {
    const { vm, persistence } = context();
    await vm.renameSelectedQuery();
    vm.selected_saved_query_id = 'b';
    vm.renameQueryName = 'Renamed A';
    const operation = vm.onRenameQueryConfirm(event());
    expect(vm.persistSavedQueries).toHaveBeenCalledWith([{ ...a, name: 'Renamed A' }, b]);
    persistence.resolve(true);
    await operation;
    expect(vm.selected_saved_query_id).toBe('b');
    expect(vm.showRenameQueryModal).toBe(false);
  });

  test('obsolete rename completion does not close a replacement modal', async () => {
    const { vm, persistence } = context();
    await vm.renameSelectedQuery();
    vm.renameQueryName = 'Renamed A';
    const operation = vm.onRenameQueryConfirm(event());
    vm.renameQueryTarget = { ...b };
    vm.renameQueryName = 'Renamed B';
    vm.showRenameQueryModal = true;
    persistence.resolve(true);
    await operation;
    expect(vm.showRenameQueryModal).toBe(true);
    expect(vm.renameQueryName).toBe('Renamed B');
  });

  test('save-as-new snapshots its opening draft and preserves a newer selection', async () => {
    const { vm, persistence } = context();
    vm.selected_saved_query_id = '';
    const expected = buildSavedQuery({ ...vm, id: 'new', name: 'New' });
    await vm.saveCurrentQuery();
    vm.query_code = b.query_code;
    vm.startdate = '2020-01-01';
    vm.event_type = 'changed';
    vm.selected_saved_query_id = 'b';
    vm.saveQueryName = 'New';
    const operation = vm.onSaveQueryConfirm(event());
    expect(vm.persistSavedQueries).toHaveBeenCalledWith([a, b, expected]);
    persistence.resolve(true);
    await operation;
    expect(vm.selected_saved_query_id).toBe('b');
  });

  test('obsolete create completion does not close a replacement modal', async () => {
    const { vm, persistence } = context();
    vm.selected_saved_query_id = '';
    await vm.saveCurrentQuery();
    vm.saveQueryName = 'New';
    const operation = vm.onSaveQueryConfirm(event());
    vm.saveQueryDraft = { query_code: 'newer' };
    vm.saveQueryName = 'Newer';
    vm.showSaveQueryModal = true;
    persistence.resolve(true);
    await operation;
    expect(vm.showSaveQueryModal).toBe(true);
    expect(vm.selected_saved_query_id).toBe('');
  });

  test('failed create retains opening draft for retry and blocks duplicate confirms', async () => {
    const { vm, persistence } = context();
    vm.selected_saved_query_id = '';
    await vm.saveCurrentQuery();
    const draft = vm.saveQueryDraft;
    vm.saveQueryName = 'Retry';
    const operation = vm.onSaveQueryConfirm(event());
    await vm.onSaveQueryConfirm(event());
    expect(vm.persistSavedQueries).toHaveBeenCalledTimes(1);
    persistence.resolve(false);
    await operation;
    expect(vm.showSaveQueryModal).toBe(true);
    expect(vm.saveQueryDraft).toBe(draft);
    expect(vm.selected_saved_query_id).toBe('');
    expect(vm.saved_query_pending).toBe(false);
  });

  test('failed rename retains target and draft for retry', async () => {
    const { vm, persistence } = context();
    await vm.renameSelectedQuery();
    const target = vm.renameQueryTarget;
    vm.renameQueryName = 'Retry A';
    const operation = vm.onRenameQueryConfirm(event());
    persistence.resolve(false);
    await operation;
    expect(vm.showRenameQueryModal).toBe(true);
    expect(vm.renameQueryTarget).toBe(target);
    expect(vm.renameQueryName).toBe('Retry A');
    expect(vm.saved_query_pending).toBe(false);
  });
});

describe('mounted saved-query modal', () => {
  let wrapper: any;
  beforeEach(() => {
    setActivePinia(createPinia());
    const settings = useSettingsStore();
    settings.$patch({ _loaded: true, saved_queries: [a, b] });
    jest.spyOn(settings, 'ensureLoaded').mockResolvedValue(undefined);
    jest.spyOn(useCategoryStore(), 'load').mockResolvedValue(undefined);
  });
  afterEach(() => {
    wrapper?.destroy();
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  test('real rename modal has a backdrop, cancels with Escape, and confirms its original target', async () => {
    const settings = useSettingsStore();
    const persistence = deferred<void>();
    const update = jest.spyOn(settings, 'update').mockReturnValue(persistence.promise);
    wrapper = mount(QueryExplorer, {
      localVue,
      attachTo: document.body,
      mocks: { $route: { query: {} }, $t: key => key },
      stubs: { icon: true, 'aw-selectable-eventview': true },
    });
    await wrapper.setData({ selected_saved_query_id: 'a' });
    await wrapper.vm.renameSelectedQuery();
    let modal: any = wrapper.findAllComponents(BModal).at(1);
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 20));
      await wrapper.vm.$nextTick();
    }
    expect(document.body.querySelector('.modal-backdrop')).not.toBeNull();
    expect(modal.vm.isVisible).toBe(true);
    // JSDOM cannot establish native layout/focus trapping; exercise the real
    // modal's keyboard handler and programmatic state changes instead.
    modal.vm.onEsc(new KeyboardEvent('keydown', { keyCode: 27 }));
    for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 20));
    expect(modal.vm.isVisible).toBe(false);
    expect(update).not.toHaveBeenCalled();
    wrapper.destroy();
    wrapper = mount(QueryExplorer, {
      localVue,
      attachTo: document.body,
      mocks: { $route: { query: {} }, $t: key => key },
      stubs: { icon: true, 'aw-selectable-eventview': true },
    });
    await wrapper.setData({ selected_saved_query_id: 'a' });
    await wrapper.vm.renameSelectedQuery();
    for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 20));
    modal = wrapper.findAllComponents(BModal).at(1);
    expect(modal.vm.isVisible).toBe(true);
    await wrapper.setData({ selected_saved_query_id: 'b', renameQueryName: 'Renamed A' });
    modal.vm.onOk(new MouseEvent('click'));
    await Promise.resolve();
    await wrapper.vm.$nextTick();
    expect(update).toHaveBeenCalledWith({ saved_queries: [b, { ...a, name: 'Renamed A' }] });
    expect(wrapper.vm.selected_saved_query_id).toBe('b');
    expect(modal.props('busy')).toBe(true);
    expect(modal.props('noCloseOnBackdrop')).toBe(true);
    expect(modal.props('noCloseOnEsc')).toBe(true);
    expect(wrapper.find('.saved-query-actions button').attributes('disabled')).toBeDefined();
    modal.vm.onEsc(new KeyboardEvent('keydown', { keyCode: 27 }));
    await wrapper.vm.$nextTick();
    expect(modal.vm.isVisible).toBe(true);
    persistence.resolve();
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 20));
    expect(wrapper.vm.showRenameQueryModal).toBe(false);
    expect(wrapper.vm.saved_query_pending).toBe(false);
  });
});
