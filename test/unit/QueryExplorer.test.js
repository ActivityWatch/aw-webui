import QueryExplorer from '~/views/QueryExplorer.vue';

describe('QueryExplorer saveCurrentQuery', () => {
  test('canceling an overwrite confirm aborts without opening the save-as-new prompt', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('Should not be used');

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
    };

    await QueryExplorer.methods.saveCurrentQuery.call(vm);

    expect(confirmSpy).toHaveBeenCalledWith('Update saved query "Daily Coding Time"?');
    expect(promptSpy).not.toHaveBeenCalled();
    expect(persistSavedQueries).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
    promptSpy.mockRestore();
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

  test('keeps save modal open when persistence fails', async () => {
    const event = { preventDefault: jest.fn() };
    const vm = {
      enddate: '2026-05-21',
      event_type: 'currentwindow',
      persistSavedQueries: jest.fn().mockResolvedValue(false),
      query_code: 'RETURN = [];',
      saveQueryName: 'Daily Coding Time',
      savedQueries: [],
      selected_saved_query_id: '',
      startdate: '2026-05-20',
    };

    await QueryExplorer.methods.onSaveQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(vm.selected_saved_query_id).toBe('');
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

  test('keeps rename modal open when persistence fails', async () => {
    const event = { preventDefault: jest.fn() };
    const selectedSavedQuery = { id: 'daily-coding-time', name: 'Daily Coding Time' };
    const vm = {
      persistSavedQueries: jest.fn().mockResolvedValue(false),
      renameQueryName: 'Coding Time',
      savedQueries: [selectedSavedQuery],
      selectedSavedQuery,
    };

    await QueryExplorer.methods.onRenameQueryConfirm.call(vm, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});
