import QueryExplorer from '~/views/QueryExplorer.vue';

describe('QueryExplorer saved query actions', () => {
  test('cancelling an update does not fall through to save-as-new', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue(null);
    const persistSavedQueries = jest.fn();

    const savedQuery = {
      id: 'daily-coding-time',
      name: 'Daily Coding Time',
      query_code: 'RETURN = [];',
      start_offset: 0,
      end_offset: -1,
      event_type: 'currentwindow',
    };

    const vm = {
      selectedSavedQuery: savedQuery,
      savedQueries: [savedQuery],
      query_code: 'RETURN = [];',
      startdate: '2026-05-20',
      enddate: '2026-05-21',
      event_type: 'currentwindow',
      persistSavedQueries,
      selected_saved_query_id: savedQuery.id,
    };

    await QueryExplorer.methods.saveCurrentQuery.call(vm);

    expect(confirmSpy).toHaveBeenCalledWith('Update saved query "Daily Coding Time"?');
    expect(promptSpy).not.toHaveBeenCalled();
    expect(persistSavedQueries).not.toHaveBeenCalled();
    expect(vm.selected_saved_query_id).toBe(savedQuery.id);
  });
});
