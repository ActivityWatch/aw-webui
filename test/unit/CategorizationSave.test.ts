import { createLocalVue, mount } from '@vue/test-utils';
import BootstrapVue, { BModal } from 'bootstrap-vue';
import { createPinia, PiniaVuePlugin, setActivePinia } from 'pinia';
import CategorizationSettings from '~/views/settings/CategorizationSettings.vue';
import CategoryEditModal from '~/components/CategoryEditModal.vue';
import CategoryEditTree from '~/components/CategoryEditTree.vue';
import { useCategoryStore } from '~/stores/categories';
import { useSettingsStore } from '~/stores/settings';
import { saveCategories } from '~/util/classes';

jest.mock('~/util/classes', () => ({
  ...jest.requireActual('~/util/classes'),
  saveCategories: jest.fn(),
}));

const mockSaveCategories = saveCategories as jest.MockedFunction<typeof saveCategories>;

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Drain async event handlers, Pinia's save queue, and BootstrapVue modal ticks.
async function flushUi() {
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
}

describe('CategorizationSettings save completion', () => {
  let wrapper: ReturnType<typeof mount>;
  let store: ReturnType<typeof useCategoryStore>;
  let requests: ReturnType<typeof deferred>[];

  const buttonsNamed = (name: string) =>
    wrapper.findAll('button').wrappers.filter(button => button.text().trim() === name);
  // The permanent Save is last; the warning also contains a Save while dirty.
  const saveButton = () => buttonsNamed('common.save').slice(-1)[0];
  const warning = () => wrapper.find('.alert-warning');
  const expectDirtyUi = () => {
    expect((saveButton().element as HTMLButtonElement).disabled).toBe(false);
    expect(warning().exists()).toBe(true);
    expect(warning().isVisible()).toBe(true);
    expect(warning().text()).toContain('settings.categorization.unsavedChanges');
  };
  const expectSavedUi = () => {
    expect((saveButton().element as HTMLButtonElement).disabled).toBe(true);
    expect(warning().exists()).toBe(false);
  };

  beforeEach(async () => {
    const localVue = createLocalVue();
    localVue.use(BootstrapVue);
    localVue.use(PiniaVuePlugin);
    const pinia = createPinia();
    setActivePinia(pinia);
    // mounted() loads through the real loadCategories helper, without a server.
    useSettingsStore().$patch({
      category_sets: [{ id: 'default', categories: [{ name: ['Work'], rule: { type: 'none' } }] }],
      active_set_ids: ['default'],
    });
    store = useCategoryStore();
    requests = [];
    mockSaveCategories.mockReset();
    mockSaveCategories.mockImplementation(() => {
      const request = deferred();
      requests.push(request);
      return request.promise;
    });
    wrapper = mount(CategorizationSettings, {
      localVue,
      pinia,
      mocks: { $t: key => key, $route: { query: {} } },
      stubs: {
        icon: { props: ['name'], template: '<span :data-icon="name" />' },
        'color-picker': true,
        CategoryBuilder: true,
        // Keep the real modal and its OK handler, but render inside the wrapper
        // rather than portalling to document.body and disable CSS transitions.
        'b-modal': {
          extends: BModal,
          props: { static: { default: true }, noFade: { default: true } },
        },
      },
    });
    await flushUi();
    expectSavedUi();
  });

  afterEach(() => {
    wrapper?.destroy();
    jest.restoreAllMocks();
  });

  async function addCategory() {
    await buttonsNamed('settings.categorization.addCategory')[0].trigger('click');
    await flushUi();
    expect(store.classes.map(category => category.name)).toContainEqual(['New class']);
    expectDirtyUi();
  }

  async function clickSave() {
    const callsBefore = mockSaveCategories.mock.calls.length;
    await saveButton().trigger('click');
    await flushUi();
    expect(mockSaveCategories).toHaveBeenCalledTimes(callsBefore + 1);
    return requests[requests.length - 1];
  }

  test('ordinary save stays dirty until persistence finishes, then disables Save', async () => {
    await addCategory();
    const request = await clickSave();
    expectDirtyUi();

    request.resolve();
    await flushUi();
    expectSavedUi();
    expect(mockSaveCategories).toHaveBeenCalledTimes(1);
  });

  test('adding a category during persistence keeps Save and warning after the earlier save resolves', async () => {
    // Restore defaults is a real UI edit that makes the first save necessary.
    await buttonsNamed('settings.categorization.restoreDefaults')[0].trigger('click');
    const first = await clickSave();
    await addCategory();

    first.resolve();
    await flushUi();
    expectDirtyUi();
    expect(store.classes.map(category => category.name)).toContainEqual(['New class']);

    const second = await clickSave();
    expect(mockSaveCategories.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categories: expect.arrayContaining([expect.objectContaining({ name: ['New class'] })]),
        }),
      ])
    );
    second.resolve();
    await flushUi();
    expectSavedUi();
  });

  test('editing a category during persistence keeps Save and warning after the earlier save resolves', async () => {
    await addCategory();
    const first = await clickSave();
    // Edit the existing Work category through its tree button and real modal.
    const tree = wrapper
      .findAllComponents(CategoryEditTree)
      .wrappers.find(component => component.text().includes('Work'));
    const edit = tree
      .findAll('button')
      .wrappers.find(button => button.find('[data-icon="edit"]').exists());
    await edit.trigger('click');
    await flushUi();
    const modal = tree.findComponent(CategoryEditModal);
    const nameGroup = modal
      .findAllComponents({ name: 'BInputGroup' })
      .wrappers.find(group => group.text().includes('ui.categoryEditor.name'));
    await nameGroup.find('input').setValue('Focused work');
    const ok = modal.findAll('button').wrappers.find(button => button.text().trim() === 'OK');
    expect((ok.element as HTMLButtonElement).disabled).toBe(false);
    await ok.trigger('click');
    await flushUi();
    expect(store.classes.map(category => category.name)).toContainEqual(['Focused work']);

    first.resolve();
    await flushUi();
    expectDirtyUi();
    expect(store.classes.map(category => category.name)).toContainEqual(['Focused work']);

    const second = await clickSave();
    expect(mockSaveCategories.mock.calls[1][0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          categories: expect.arrayContaining([expect.objectContaining({ name: ['Focused work'] })]),
        }),
      ])
    );
    second.resolve();
    await flushUi();
    expectSavedUi();
  });

  test('failed persistence leaves Save and warning available and a button retry can succeed', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await addCategory();
    const first = await clickSave();
    first.reject(new Error('offline'));
    await flushUi();
    expectDirtyUi();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('offline'));

    const retry = await clickSave();
    expectDirtyUi();
    retry.resolve();
    await flushUi();
    expectSavedUi();
    expect(alertSpy).toHaveBeenCalledTimes(1);
  });
});
