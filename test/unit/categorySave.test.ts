import { createPinia, setActivePinia } from 'pinia';
import { useCategoryStore } from '~/stores/categories';
import { Category } from '~/util/classes';

const mockUpdate = jest.fn();
jest.mock('~/stores/settings', () => ({
  useSettingsStore: () => ({ update: mockUpdate }),
}));
// Exercise the real persistence helper, including its payload construction.
// Only bypass the helper's test-only no-write guard, never the async store path.
jest.mock('~/util/classes', () => {
  const actual = jest.requireActual('~/util/classes');
  return {
    ...actual,
    saveCategories: (...args) => {
      const env = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        return actual.saveCategories(...args);
      } finally {
        process.env.NODE_ENV = env;
      }
    },
  };
});

const category = (name: string): Category => ({
  name: [name],
  rule: { type: 'regex', regex: name.toLowerCase() },
});
const deferred = () => {
  let resolve: () => void;
  let reject: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve: () => resolve(), reject: (error: Error) => reject(error) };
};
const clone = value => JSON.parse(JSON.stringify(value));
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
let store: ReturnType<typeof useCategoryStore>;
let writes: any[];
let requests: ReturnType<typeof deferred>[];

beforeEach(() => {
  setActivePinia(createPinia());
  store = useCategoryStore();
  store.category_sets = [
    { id: 'mine', categories: [category('A')] },
    { id: 'other', categories: [category('Other')] },
  ];
  store.active_set_ids = ['mine'];
  store.discardChanges();
  store.classes_unsaved_changes = true;
  writes = [];
  requests = [];
  mockUpdate.mockReset().mockImplementation(value => {
    writes.push(value);
    const request = deferred();
    requests.push(request);
    return request.promise;
  });
});

test('unchanged completion acknowledges a detached category payload', async () => {
  const saving = store.save();
  expect(mockUpdate).toHaveBeenCalledTimes(1);
  expect(store.classes_unsaved_changes).toBe(true);
  expect(writes[0].classes.map(c => c.name)).toEqual([['A']]);
  expect(writes[0].active_set_ids).toEqual(['mine']);
  requests[0].resolve();
  await saving;
  expect(store.classes_unsaved_changes).toBe(false);
});

const mutations: [string, (s: ReturnType<typeof useCategoryStore>) => void][] = [
  ['add', s => s.addClass(category('B'))],
  [
    'edit',
    s => s.updateClass({ ...s.get_category(['A']), rule: { type: 'regex', regex: 'edited' } }),
  ],
  ['remove', s => s.removeClass(s.classes[0].id)],
  ['append rule', s => s.appendClassRule(s.classes[0].id, 'new')],
  ['import', s => s.import([category('Imported')])],
  ['clear', s => s.clearAll()],
  ['restore defaults', s => s.restoreDefaultClasses()],
  ['create set', s => s.createSet('new')],
  ['delete set', s => s.deleteSet('other')],
  ['rename set', s => s.renameSet('mine', 'renamed')],
  ['switch set', s => s.switchToSet('other')],
  ['active sets', s => s.setActiveSets(['mine', 'other'])],
  ['import set on top', s => s.importSetOnTop('imported', [category('Imported')])],
  // CategorizationSettings also replaces imported set contents directly.
  ['direct set edit', s => s.category_sets[1].categories.push(category('Imported'))],
  ['direct active IDs edit', s => s.active_set_ids.push('other')],
];

test.each(mutations)('%s during persistence remains unsaved', async (_name, mutate) => {
  const saving = store.save();
  const submitted = clone(writes[0]);
  mutate(store);
  expect(writes[0]).toEqual(submitted);
  requests[0].resolve();
  await saving;
  expect(store.classes_unsaved_changes).toBe(true);
});

test('rejection retains dirty state and an unchanged retry can acknowledge it', async () => {
  const saving = store.save();
  requests[0].reject(new Error('offline'));
  await expect(saving).rejects.toThrow('offline');
  expect(store.classes_unsaved_changes).toBe(true);
  const retry = store.save();
  expect(mockUpdate).toHaveBeenCalledTimes(2);
  requests[1].resolve();
  await retry;
  expect(store.classes_unsaved_changes).toBe(false);
});

test.each([false, true])(
  'overlapping saves serialize writes (first fails: %s)',
  async failFirst => {
    const first = store.save();
    const firstResult = first.catch(error => error);
    store.addClass(category('B'));
    const second = store.save();
    store.addClass(category('C'));
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    if (failFirst) requests[0].reject(new Error('offline'));
    else requests[0].resolve();
    await firstResult;
    await flush();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(writes[1].classes.map(c => c.name)).toEqual([['A'], ['B']]);
    expect(store.classes_unsaved_changes).toBe(true);
    requests[1].resolve();
    await second;
    expect(store.classes_unsaved_changes).toBe(true); // C was never submitted.
    const third = store.save();
    requests[2].resolve();
    await third;
    expect(store.classes_unsaved_changes).toBe(false);
  }
);

test('an earlier matching snapshot stays dirty while a different snapshot is queued', async () => {
  const first = store.save();
  store.addClass(category('B'));
  const second = store.save();
  store.removeClass(store.get_category(['B']).id); // Current content matches first again.
  requests[0].resolve();
  await first;
  await flush();
  expect(store.classes_unsaved_changes).toBe(true);
  requests[1].resolve();
  await second;
  expect(store.classes_unsaved_changes).toBe(true); // Persisted B, current has no B.
});

test('different Pinia stores do not block one another', async () => {
  const first = store.save();
  const other = useCategoryStore(createPinia());
  other.load([category('Separate')]);
  const second = other.save();
  expect(mockUpdate).toHaveBeenCalledTimes(2);
  requests[1].resolve(); // Independent stores can finish in the other order.
  await second;
  expect(other.classes_unsaved_changes).toBe(false);
  expect(store.classes_unsaved_changes).toBe(true);
  requests[0].resolve();
  await first;
});
