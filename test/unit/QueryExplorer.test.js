import QueryExplorer from '~/views/QueryExplorer.vue';

describe('QueryExplorer saveCurrentQuery', () => {
  test('canceling an overwrite confirm aborts without opening the save-as-new prompt', async () => {
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('Should not be used');
    const msgBoxConfirm = jest.fn().mockResolvedValue(false);

    const persistSavedQueries = jest.fn();
    const vm = {
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
      $bvModal: { msgBoxConfirm },
    };

    await QueryExplorer.methods.saveCurrentQuery.call(vm);

    expect(msgBoxConfirm).toHaveBeenCalledWith(
      'Update saved query "Daily Coding Time"?',
      expect.objectContaining({ okTitle: 'Update' })
    );
    expect(promptSpy).not.toHaveBeenCalled();
    expect(persistSavedQueries).not.toHaveBeenCalled();

    promptSpy.mockRestore();
  });

  test('canceling delete keeps the selected query', async () => {
    const selectedSavedQuery = { id: 'daily-coding-time', name: 'Daily Coding Time' };
    const persistSavedQueries = jest.fn();
    const vm = {
      persistSavedQueries,
      savedQueries: [selectedSavedQuery],
      selectedSavedQuery,
      selected_saved_query_id: selectedSavedQuery.id,
      $bvModal: { msgBoxConfirm: jest.fn().mockResolvedValue(false) },
    };

    await QueryExplorer.methods.deleteSelectedQuery.call(vm);

    expect(vm.$bvModal.msgBoxConfirm).toHaveBeenCalledWith(
      'Delete saved query "Daily Coding Time"? This cannot be undone.',
      expect.objectContaining({ okTitle: 'Delete', okVariant: 'danger' })
    );
    expect(persistSavedQueries).not.toHaveBeenCalled();
    expect(vm.selected_saved_query_id).toBe(selectedSavedQuery.id);
  });

  test('deletes the confirmed query when a pending save changes the selection', async () => {
    const queryA = { id: 'a', name: 'Query A' };
    const queryB = { id: 'b', name: 'Query B' };
    let confirmDelete;
    const vm = {
      persistSavedQueries: jest.fn().mockResolvedValue(true),
      savedQueries: [queryA, queryB],
      selectedSavedQuery: queryB,
      selected_saved_query_id: queryB.id,
      $bvModal: {
        msgBoxConfirm: jest.fn().mockReturnValue(
          new Promise(resolve => {
            confirmDelete = resolve;
          })
        ),
      },
    };

    const deletion = QueryExplorer.methods.deleteSelectedQuery.call(vm);
    expect(vm.$bvModal.msgBoxConfirm).toHaveBeenCalledWith(
      'Delete saved query "Query B"? This cannot be undone.',
      expect.any(Object)
    );
    // A pending save finishes while B's confirmation dialog is open.
    vm.selected_saved_query_id = queryA.id;
    vm.selectedSavedQuery = queryA;
    confirmDelete(true);
    await deletion;

    expect(vm.persistSavedQueries).toHaveBeenCalledWith([queryA]);
    expect(vm.selected_saved_query_id).toBe(queryA.id);
  });

  test.each([true, false])(
    'delete clears selection only after persistence succeeds=%s',
    async didPersist => {
      const selectedSavedQuery = { id: 'a', name: 'Query A' };
      const vm = {
        persistSavedQueries: jest.fn().mockResolvedValue(didPersist),
        savedQueries: [selectedSavedQuery],
        selectedSavedQuery,
        selected_saved_query_id: selectedSavedQuery.id,
        $bvModal: { msgBoxConfirm: jest.fn().mockResolvedValue(true) },
      };

      await QueryExplorer.methods.deleteSelectedQuery.call(vm);

      expect(vm.persistSavedQueries).toHaveBeenCalledWith([]);
      expect(vm.selected_saved_query_id).toBe(didPersist ? '' : selectedSavedQuery.id);
    }
  );

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
      savedQueries: [selectedSavedQuery],
      selectedSavedQuery,
      showRenameQueryModal: true,
    };

    await QueryExplorer.methods.onRenameQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.showRenameQueryModal).toBe(false);
  });
});
