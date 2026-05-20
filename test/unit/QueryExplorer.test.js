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
});
