import { setActivePinia, createPinia } from 'pinia';

import { useActivityStore } from '~/stores/activity';

describe('activity load progress', () => {
  setActivePinia(createPinia());
  const store = useActivityStore();

  test('counts requests of the current load', () => {
    store.start_loading({ host: 'h' });
    const id = store.load_id;
    store.progress_add(id, 7);
    store.progress_add(id, 7);
    store.progress_tick(id);
    expect(store.progress).toMatchObject({ done: 1, total: 14 });
  });

  test('a new load resets progress and ignores the aborted one', () => {
    store.start_loading({ host: 'h' });
    const oldId = store.load_id;
    store.progress_add(oldId, 365);
    store.progress_tick(oldId);

    store.start_loading({ host: 'h' });
    const newId = store.load_id;
    expect(store.progress).toBeNull();

    // Late results from the aborted load
    store.progress_add(oldId, 365);
    store.progress_tick(oldId);
    expect(store.progress).toBeNull();

    store.progress_add(newId, 7);
    store.progress_tick(oldId);
    expect(store.progress).toMatchObject({ done: 0, total: 7 });
  });
});
