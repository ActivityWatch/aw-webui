import QueryExplorerComponent from '~/views/QueryExplorer.vue';
import { buildSavedQuery } from '~/util/savedQueries';

const saveQueryDraft = () =>
  buildSavedQuery({
    id: '',
    name: '',
    query_code: 'RETURN = [];',
    startdate: '2026-05-20',
    enddate: '2026-05-21',
    event_type: 'currentwindow',
  });

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const QueryExplorer: any = QueryExplorerComponent;

describe('QueryExplorer saveCurrentQuery', () => {
  test('canceling an overwrite confirm aborts without opening the save-as-new prompt', async () => {
    const msgBoxConfirm = jest.fn().mockResolvedValue(false);
    const persistSavedQueries = jest.fn();
    const vm = {
      $bvModal: { msgBoxConfirm },
      enddate: '2026-05-21',
      event_type: 'currentwindow',
      persistSavedQueries,
      query_code: 'RETURN = [];',
      savedQueries: [
        {
          id: 'daily-coding-time',
          name: 'Daily Coding Time',
          query_code: 'RETURN = [];',
          start_day_offset: 0,
          end_day_offset: -1,
          event_type: 'currentwindow',
        },
      ],
      selectedSavedQuery: {
        id: 'daily-coding-time',
        name: 'Daily Coding Time',
        query_code: 'RETURN = [];',
        start_day_offset: 0,
        end_day_offset: -1,
        event_type: 'currentwindow',
      },
      selected_saved_query_id: 'daily-coding-time',
      startdate: '2026-05-20',
    };

    await QueryExplorer.methods.saveCurrentQuery.call(vm);

    expect(msgBoxConfirm).toHaveBeenCalledWith(
      'Update saved query "Daily Coding Time"?',
      expect.objectContaining({ title: 'Update Query' })
    );
    expect(persistSavedQueries).not.toHaveBeenCalled();
  });

  test('keeps save modal open when the query name is blank', async () => {
    const event = { preventDefault: jest.fn() };
    const vm = {
      saveQueryName: '   ',
      saved_query_error: '',
    };

    await QueryExplorer.methods.onSaveQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.saved_query_error).toBe('Saved query name cannot be empty.');
  });

  test('cancels save modal closure before awaiting persistence failure', async () => {
    const event = { preventDefault: jest.fn() };
    let resolvePersistence;
    const persistence = new Promise(resolve => {
      resolvePersistence = resolve;
    });
    const vm = {
      enddate: '2026-05-21',
      event_type: 'currentwindow',
      persistSavedQueries: jest.fn().mockReturnValue(persistence),
      query_code: 'RETURN = [];',
      saveQueryName: 'Daily Coding Time',
      saveQueryDraft: saveQueryDraft(),
      savedQueries: [],
      selected_saved_query_id: '',
      showSaveQueryModal: true,
      startdate: '2026-05-20',
    };

    const confirmation = QueryExplorer.methods.onSaveQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.showSaveQueryModal).toBe(true);

    resolvePersistence(false);
    await confirmation;

    expect(vm.selected_saved_query_id).toBe('');
    expect(vm.showSaveQueryModal).toBe(true);
  });

  test('closes save modal after persistence succeeds', async () => {
    const event = { preventDefault: jest.fn() };
    const vm = {
      enddate: '2026-05-21',
      event_type: 'currentwindow',
      persistSavedQueries: jest.fn().mockResolvedValue(true),
      query_code: 'RETURN = [];',
      saveQueryName: 'Daily Coding Time',
      saveQueryDraft: saveQueryDraft(),
      savedQueries: [],
      selected_saved_query_id: '',
      showSaveQueryModal: true,
      startdate: '2026-05-20',
    };

    await QueryExplorer.methods.onSaveQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.selected_saved_query_id).not.toBe('');
    expect(vm.showSaveQueryModal).toBe(false);
  });

  test('keeps rename modal open when the query name is blank', async () => {
    const event = { preventDefault: jest.fn() };
    const vm = {
      renameQueryName: '   ',
      saved_query_error: '',
      selectedSavedQuery: { id: 'daily-coding-time', name: 'Daily Coding Time' },
    };

    await QueryExplorer.methods.onRenameQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.saved_query_error).toBe('Saved query name cannot be empty.');
  });

  test('cancels rename modal closure before awaiting persistence failure', async () => {
    const event = { preventDefault: jest.fn() };
    let resolvePersistence;
    const persistence = new Promise(resolve => {
      resolvePersistence = resolve;
    });
    const selectedSavedQuery = { id: 'daily-coding-time', name: 'Daily Coding Time' };
    const vm = {
      persistSavedQueries: jest.fn().mockReturnValue(persistence),
      renameQueryName: 'Coding Time',
      renameQueryTarget: { ...selectedSavedQuery },
      savedQueries: [selectedSavedQuery],
      selectedSavedQuery,
      showRenameQueryModal: true,
    };

    const confirmation = QueryExplorer.methods.onRenameQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.showRenameQueryModal).toBe(true);

    resolvePersistence(false);
    await confirmation;

    expect(vm.showRenameQueryModal).toBe(true);
  });

  test('closes rename modal after persistence succeeds', async () => {
    const event = { preventDefault: jest.fn() };
    const selectedSavedQuery = { id: 'daily-coding-time', name: 'Daily Coding Time' };
    const vm = {
      persistSavedQueries: jest.fn().mockResolvedValue(true),
      renameQueryName: 'Coding Time',
      renameQueryTarget: { ...selectedSavedQuery },
      savedQueries: [selectedSavedQuery],
      selectedSavedQuery,
      showRenameQueryModal: true,
    };

    await QueryExplorer.methods.onRenameQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.showRenameQueryModal).toBe(false);
  });
});

describe('QueryExplorer eventcount_str', () => {
  const event = { timestamp: '2026-10-31T12:00:00Z', duration: 10, data: { title: 'Code' } };

  test('counts ordinary and empty event arrays', () => {
    expect(QueryExplorer.computed.eventcount_str.call({ events: [event] })).toBe(
      'Number of events: 1'
    );
    expect(QueryExplorer.computed.eventcount_str.call({ events: [] })).toBe('Number of events: 0');
  });

  test.each([[42], [{ total: 42 }], [null], [[1, 2]], [[{ duration: 5, label: 'total' }]]])(
    'does not label non-event result %p as events',
    value => {
      expect(QueryExplorer.computed.eventcount_str.call({ events: value })).toBe('');
    }
  );
});

// ActivityWatch/aw-webui#1328 item 7: settingsStore.update() applies the new
// list before the request, so a failed save must restore the previous one.
describe('QueryExplorer saved-query persistence failure', () => {
  const { createPinia, setActivePinia } = jest.requireActual('pinia');
  const { useSettingsStore } = jest.requireActual('~/stores/settings');
  const { createClient, getClient } = jest.requireActual('~/util/awclient');
  const existing = { ...saveQueryDraft(), id: 'existing', name: 'existing' };
  let settingsStore, save, getSettings;

  beforeAll(() => createClient());
  beforeEach(() => {
    setActivePinia(createPinia());
    settingsStore = useSettingsStore();
    settingsStore.$patch({ saved_queries: [existing] });
    jest.spyOn(settingsStore, 'ensureLoaded').mockResolvedValue(undefined);
    save = jest.spyOn(settingsStore, 'save');
    // Default: the server cannot be reached to read back what it holds.
    getSettings = jest.spyOn(getClient(), 'get_settings').mockRejectedValue(new Error('offline'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  function makeExplorer() {
    const vm: any = {
      settingsStore,
      saved_query_error: '',
      saved_query_pending: false,
      selected_saved_query_id: '',
      saveQueryDraft: saveQueryDraft(),
      saveQueryName: 'foo',
      showSaveQueryModal: true,
    };
    vm.persistSavedQueries = list => QueryExplorer.methods.persistSavedQueries.call(vm, list);
    Object.defineProperty(vm, 'savedQueries', {
      get: () => QueryExplorer.computed.savedQueries.call(vm),
    });
    return vm;
  }
  const ids = () => settingsStore.saved_queries.map(q => q.id);

  test('a failed save keeps existing presets, leaves no phantom, and a retry does not duplicate', async () => {
    const explorer = makeExplorer();
    save.mockRejectedValueOnce(new Error('offline'));
    await QueryExplorer.methods.onSaveQueryConfirm.call(explorer, { preventDefault: jest.fn() });
    expect(ids()).toEqual(['existing']);
    expect(explorer.saved_query_error).not.toBe('');
    expect(explorer.showSaveQueryModal).toBe(true);

    save.mockResolvedValueOnce(undefined);
    await QueryExplorer.methods.onSaveQueryConfirm.call(explorer, { preventDefault: jest.fn() });
    expect(ids()).toEqual(['existing', 'foo']);
  });

  test('a save the server stored is kept when only the follow-up reload fails', async () => {
    const explorer = makeExplorer();
    const stored = [existing, { ...existing, id: 'foo', name: 'foo' }];
    save.mockRejectedValueOnce(new Error('reload failed'));
    getSettings.mockResolvedValueOnce({ saved_queries: stored });
    const ok = await explorer.persistSavedQueries(stored);
    expect(ok).toBe(true);
    expect(ids()).toEqual(['existing', 'foo']);
    expect(explorer.saved_query_error).toBe('');
  });

  test.each([
    ['write', true],
    ['write', false],
    ['read-back', true],
    ['read-back', false],
  ])(
    'blocks a remounted editor during %s, then retries after success=%s',
    async (phase, succeeds) => {
      const foo = { ...existing, id: 'foo', name: 'foo' };
      let started!: () => void;
      const firstPending = new Promise<void>(resolve => (started = resolve));
      let finish!: () => void;
      if (phase === 'write') {
        save.mockImplementationOnce(() => {
          started();
          return new Promise<void>((resolve, reject) => {
            finish = () => (succeeds ? resolve() : reject(new Error('offline')));
          });
        });
      } else {
        save.mockRejectedValueOnce(new Error('reload failed'));
        getSettings.mockImplementationOnce(() => {
          started();
          return new Promise((resolve, reject) => {
            finish = () =>
              succeeds ? resolve({ saved_queries: [existing, foo] }) : reject(new Error('offline'));
          });
        });
      }
      const first = makeExplorer().persistSavedQueries([existing, foo]);
      await firstPending;

      // Navigation destroys the first component's busy flag, not the shared store.
      const remounted = makeExplorer();
      remounted.saveQueryName = 'bar';
      const draft = remounted.saveQueryDraft;
      const confirmDraft = () =>
        QueryExplorer.methods.onSaveQueryConfirm.call(remounted, {
          preventDefault: jest.fn(),
        });
      await confirmDraft();
      expect(save).toHaveBeenCalledTimes(1);
      expect(ids()).toEqual(['existing', 'foo']);
      expect(remounted.saved_query_error).toMatch(/in progress.*retry/i);
      expect(remounted.showSaveQueryModal).toBe(true);
      expect(remounted.saveQueryDraft).toBe(draft);
      expect(remounted.saveQueryName).toBe('bar');
      expect(remounted.saved_query_pending).toBe(false);

      finish();
      expect(await first).toBe(succeeds);
      expect(ids()).toEqual(succeeds ? ['existing', 'foo'] : ['existing']);
      if (phase === 'read-back' && succeeds) {
        // Both writes can land but require recovery after their reload fails.
        // The second read-back starts only once the first is authoritative.
        save.mockRejectedValueOnce(new Error('reload failed'));
        getSettings.mockImplementationOnce(async () => ({
          saved_queries: JSON.parse(JSON.stringify(settingsStore.saved_queries)),
        }));
      } else {
        save.mockResolvedValueOnce(undefined);
      }
      await confirmDraft();
      expect(ids()).toEqual(succeeds ? ['bar', 'existing', 'foo'] : ['bar', 'existing']);
      expect(remounted.saved_query_error).toBe('');
      expect(remounted.showSaveQueryModal).toBe(false);
      expect(save).toHaveBeenCalledTimes(2);
    }
  );

  test('a retry after an optimistic delete fails preserves the restored preset', async () => {
    let failDelete!: (error: Error) => void;
    save.mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => (failDelete = reject))
    );
    const deletion = makeExplorer().persistSavedQueries([]);
    const remounted = makeExplorer();
    const confirmDraft = () =>
      QueryExplorer.methods.onSaveQueryConfirm.call(remounted, {
        preventDefault: jest.fn(),
      });
    await confirmDraft();
    expect(save).toHaveBeenCalledTimes(1);
    expect(remounted.showSaveQueryModal).toBe(true);
    failDelete(new Error('offline'));
    expect(await deletion).toBe(false);
    expect(ids()).toEqual(['existing']);
    save.mockResolvedValueOnce(undefined);
    await confirmDraft();
    expect(ids()).toEqual(['existing', 'foo']);
    expect(remounted.saved_query_error).toBe('');
  });

  test('a stored preset with a cleared date is recognised as saved after a reload failure', async () => {
    const explorer = makeExplorer();
    const cleared = { ...existing, id: 'nan', name: 'nan', start_day_offset: NaN };
    const attempted = [existing, cleared];
    save.mockRejectedValueOnce(new Error('reload failed'));
    getSettings.mockResolvedValueOnce({ saved_queries: JSON.parse(JSON.stringify(attempted)) });
    expect(await explorer.persistSavedQueries(attempted)).toBe(true);
    expect(explorer.saved_query_error).toBe('');
  });
});
