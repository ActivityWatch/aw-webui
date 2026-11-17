import { createLocalVue, mount, Wrapper } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import { createPinia, PiniaVuePlugin, setActivePinia } from 'pinia';
import cloneDeep from 'lodash/cloneDeep';
import Vue from 'vue';
import CategorizationSettings from '~/views/settings/CategorizationSettings.vue';
import { useCategoryStore } from '~/stores/categories';
import { Category } from '~/util/classes';
import { downloadFile } from '~/util/export';

// Only the download transport is replaced; parsing, cleaning and store actions are real.
jest.mock('~/util/export', () => ({ downloadFile: jest.fn().mockResolvedValue(undefined) }));

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);
localVue.use(BootstrapVue);

const category = (name: string, regex = name): Category => ({
  name: [name],
  rule: { type: 'regex', regex },
});

const invalidMembers: [string, unknown][] = [
  ['null member', null],
  ['nonobject member', 'Work'],
  ['array member', []],
  ['numeric name', { name: 12, rule: { type: 'none' } }],
  ['mixed name segments', { name: ['Work', 12], rule: { type: 'none' } }],
  ['missing rule', { name: ['Work'] }],
  ['null rule', { name: ['Work'], rule: null }],
  ['nonobject rule', { name: ['Work'], rule: 'none' }],
  ['unknown rule type', { name: ['Work'], rule: { type: 'other' } }],
  ['numeric regex', { name: ['Work'], rule: { type: 'regex', regex: 12 } }],
  ['nonobject metadata', { ...category('Work'), data: 'metadata' }],
  ['array metadata', { ...category('Work'), data: [] }],
  ['numeric color', { ...category('Work'), data: { color: 12 } }],
  ['nonnumeric score', { ...category('Work'), data: { score: 'high' } }],
  [
    'nonboolean ignore_case',
    { name: ['Work'], rule: { type: 'regex', regex: 'x', ignore_case: 'yes' } },
  ],
  [
    'nonnumeric priority',
    { name: ['Work'], rule: { type: 'regex', regex: 'x', priority: 'high' } },
  ],
  [
    'nonarray select_keys',
    { name: ['Work'], rule: { type: 'regex', regex: 'x', select_keys: 'app' } },
  ],
  [
    'mixed select_keys',
    { name: ['Work'], rule: { type: 'regex', regex: 'x', select_keys: ['app', 12] } },
  ],
];

type ImportMode = 'replace' | 'layer' | 'legacy';

let wrapper: Wrapper<Vue>;
let store: ReturnType<typeof useCategoryStore>;
let alertSpy: jest.SpyInstance;

// Vue's DOM trigger does not await an async event listener. Drain file.text(),
// its import continuation and the resulting reactive render before asserting.
async function flushImport() {
  await new Promise(resolve => setTimeout(resolve, 0));
  await localVue.nextTick();
}

async function mountSettings(dirty = false) {
  const pinia = createPinia();
  setActivePinia(pinia);
  store = useCategoryStore();
  store.$patch({
    category_sets: [
      { id: 'mine', categories: [category('Work', 'local')] },
      { id: 'shared', categories: [category('Shared', 'old')] },
      { id: 'mine-imported', categories: [category('Reserved')] },
      { id: 'shared-imported', categories: [category('Other reserved')] },
    ],
    active_set_ids: ['mine', 'shared'],
  });
  store.discardChanges();
  if (dirty) store.addClass(category('Unsaved', 'draft'));
  // mounted() ordinarily loads settings; no server is involved in these tests.
  jest.spyOn(store, 'load').mockImplementation(() => undefined);
  jest.spyOn(store, 'save');
  wrapper = mount(CategorizationSettings, {
    localVue,
    pinia,
    mocks: { $route: { query: {} }, $t: (key: string) => key },
    stubs: {
      CategoryEditTree: true,
      CategoryEditModal: true,
      CategoryBuilder: true,
      icon: true,
      // Keep the actual settings buttons and handlers, but avoid modal portals/transitions.
      'b-modal': {
        props: ['value'],
        template: '<section v-if="value" role="dialog"><slot /></section>',
      },
    },
  });
  await flushImport();
}

function snapshot() {
  // Effective classes share nested objects with stored sets. A shallow snapshot
  // (or retaining store.$state) would silently change with a partially failed import.
  return cloneDeep({
    sets: store.category_sets,
    classes: store.classes,
    active: store.active_set_ids,
    dirty: store.classes_unsaved_changes,
  });
}

function fileFor(value: unknown) {
  // jsdom's File lacks text(); provide the real browser-facing File shape with
  // an asynchronous text method rather than bypassing the file/parser boundary.
  return {
    name: 'categories.json',
    type: 'application/octet-stream',
    text: jest.fn().mockResolvedValue(JSON.stringify(value)),
  };
}

async function selectFile(file: ReturnType<typeof fileFor>) {
  const input = wrapper.find('input[type="file"]');
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });
  // Browsers permit only clearing a file input's value; an own property lets us
  // verify the handler clears the selection to allow the same-file retry.
  Object.defineProperty(input.element, 'value', {
    configurable: true,
    writable: true,
    value: 'C:\\fakepath\\categories.json',
  });
  await input.trigger('change');
  await flushImport();
  expect(file.text).toHaveBeenCalled();
  expect((input.element as HTMLInputElement).value).toBe('');
}

async function clickButton(key: string) {
  const button = wrapper.findAll('button').wrappers.find(candidate => candidate.text() === key);
  if (!button) throw new Error(`Missing settings button: ${key}`);
  await button.trigger('click');
  await flushImport();
}

async function chooseImport(mode: ImportMode) {
  if (mode !== 'legacy') {
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    await clickButton(
      `settings.categorization.${mode === 'replace' ? 'importReplace' : 'importAddOnTop'}`
    );
  }
}

beforeEach(() => {
  alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  jest.mocked(downloadFile).mockClear();
});

afterEach(() => {
  wrapper?.destroy();
  jest.restoreAllMocks();
});

for (const mode of ['replace', 'layer', 'legacy'] as ImportMode[]) {
  for (const dirty of [false, true]) {
    describe(`${mode} import with ${dirty ? 'unsaved' : 'clean'} categories`, () => {
      test.each(invalidMembers)(
        'rejects %s before offering or applying an import',
        async (_, bad) => {
          await mountSettings(dirty);
          const before = snapshot();
          const categories = [category('Valid first'), bad];
          const file = fileFor(mode === 'legacy' ? { categories } : { id: 'mine', categories });

          await selectFile(file);

          expect(snapshot()).toEqual(before);
          expect(store.save).not.toHaveBeenCalled();
          expect(alertSpy).toHaveBeenCalledTimes(1);
          expect(alertSpy.mock.calls[0][0]).toMatch(/import/i);
          expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
          expect((wrapper.vm as any).pendingImportCategories).toBeNull();
        }
      );
    });
  }
}

describe('valid mounted category imports', () => {
  test.each([
    ['mine', 'mine'],
    ['shared', 'shared-imported-imported'],
  ])(
    'Replace %s resolves collisions as %s without overwriting other sets',
    async (id, expectedId) => {
      await mountSettings(true);
      const untouched = cloneDeep(store.category_sets.filter(set => set.id !== expectedId));
      const categories = [category('Imported', 'new')];
      await selectFile(fileFor({ id, categories }));
      expect(store.get_category(['Unsaved'])).toBeDefined();
      await chooseImport('replace');

      expect(store.active_set_ids).toEqual([expectedId, ...(id === 'mine' ? ['shared'] : [])]);
      expect(store.get_category(['Imported']).rule.regex).toBe('new');
      // Switching to a new set may sync local edits to mine; unrelated sets stay untouched.
      for (const set of untouched.filter(candidate => candidate.id !== 'mine')) {
        expect(store.category_sets.find(current => current.id === set.id)).toEqual(set);
      }
      expect(store.category_sets.find(set => set.id === expectedId)?.categories).toEqual(
        categories
      );
      expect(store.classes_unsaved_changes).toBe(true);
      expect(alertSpy).not.toHaveBeenCalled();
    }
  );

  test.each([
    ['mine', 'mine-imported-imported'],
    ['shared', 'shared'],
  ])('Add on top %s resolves collisions as %s and keeps local edits', async (id, expectedId) => {
    await mountSettings(true);
    const reserved = cloneDeep(store.category_sets.filter(set => set.id.endsWith('-imported')));
    const categories = [category('Work', 'remote'), category('Shared', 'new')];
    await selectFile(fileFor({ id, categories }));
    await chooseImport('layer');

    expect(store.active_set_ids).toEqual(
      expectedId === 'shared' ? ['mine', 'shared'] : ['mine', 'shared', expectedId]
    );
    expect(store.get_category(['Work']).rule.regex).toBe('local');
    expect(store.get_category(['Shared']).rule.regex).toBe(id === 'shared' ? 'new' : 'old');
    expect(store.get_category(['Unsaved']).rule.regex).toBe('draft');
    expect(store.category_sets.find(set => set.id === expectedId)?.categories).toEqual(categories);
    expect(store.category_sets.filter(set => set.id.endsWith('-imported'))).toEqual(
      expectedId === 'shared' ? reserved : [...reserved, { id: expectedId, categories }]
    );
    expect(store.classes_unsaved_changes).toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test.each(['replace', 'layer', 'legacy'] as ImportMode[])(
    '%s accepts an intentionally empty category array',
    async mode => {
      await mountSettings();
      await selectFile(
        fileFor(mode === 'legacy' ? { categories: [] } : { id: 'mine', categories: [] })
      );
      await chooseImport(mode);

      if (mode === 'layer') {
        expect(store.active_set_ids).toEqual(['mine', 'shared', 'mine-imported-imported']);
        expect(
          store.category_sets.find(set => set.id === 'mine-imported-imported')?.categories
        ).toEqual([]);
        expect(store.get_category(['Work']).rule.regex).toBe('local');
      } else {
        expect(store.category_sets.find(set => set.id === 'mine')?.categories).toEqual([]);
        if (mode === 'legacy') expect(store.classes).toEqual([]);
        else expect(store.classes.map(cat => cat.name)).toEqual([['Shared']]);
      }
      expect(store.classes_unsaved_changes).toBe(true);
      expect(alertSpy).not.toHaveBeenCalled();
    }
  );

  test('legacy import creates missing parents and retains an editable malformed regex string', async () => {
    await mountSettings(true);
    const categories = [
      { name: ['Imported', 'Child'], rule: { type: 'regex', regex: '[', ignore_case: true } },
      { name: ['Uncategorized'], rule: { type: null } },
    ];
    await selectFile(fileFor({ categories }));

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(store.get_category(['Imported']).rule).toEqual({ type: 'none' });
    expect(store.get_category(['Imported', 'Child']).rule.regex).toBe('[');
    // Legacy null types are accepted, then normalized by the real store cleaner.
    expect(store.get_category(['Uncategorized']).rule.type).toBe('none');
    expect(store.classes_unsaved_changes).toBe(true);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('metadata and select_keys survive importing, exporting and importing the exported file', async () => {
    await mountSettings();
    const categories = [
      {
        name: ['Imported'],
        rule: {
          type: 'regex',
          regex: 'Editor',
          ignore_case: false,
          priority: 0,
          weight: 2,
          select_keys: ['app', 'title', 'app'],
        },
        data: { color: '#123456', score: 0, custom: { source: 'shared' } },
      },
      { name: ['Inherited'], rule: { type: 'none' }, data: { color: null, score: null } },
    ];
    await selectFile(fileFor({ id: 'mine', categories }));
    await chooseImport('replace');
    await clickButton('common.export');

    expect(downloadFile).toHaveBeenCalledTimes(1);
    const [filename, text, mime] = jest.mocked(downloadFile).mock.calls[0];
    expect(filename).toBe('aw-category-export-mine.json');
    expect(mime).toBe('application/json');
    const exported = JSON.parse(text);
    expect(exported.categories.find(cat => cat.name[0] === 'Imported')).toEqual({
      ...categories[0],
      id: store.get_category(['Imported']).id,
      rule: { ...categories[0].rule, select_keys: ['app', 'title'] },
    });
    expect(exported.categories.find(cat => cat.name[0] === 'Inherited')).toEqual({
      ...categories[1],
      id: store.get_category(['Inherited']).id,
    });
    const before = cloneDeep(store.classes_clean);
    await selectFile(fileFor(exported));
    await chooseImport('replace');
    expect(store.classes_clean).toEqual(before);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  test('the same selected file can be corrected and retried after rejection', async () => {
    await mountSettings(true);
    const before = snapshot();
    const file = fileFor({ id: 'mine', categories: [null] });
    await selectFile(file);
    expect(snapshot()).toEqual(before);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);

    file.text.mockResolvedValue(
      JSON.stringify({ id: 'mine', categories: [category('Corrected')] })
    );
    await selectFile(file);
    await chooseImport('replace');
    expect(file.text).toHaveBeenCalledTimes(2);
    expect(store.get_category(['Corrected']).rule.regex).toBe('Corrected');
    expect(store.classes_unsaved_changes).toBe(true);
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
