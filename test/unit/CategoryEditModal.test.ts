import en from '~/i18n/locales/en';
import { createLocalVue, mount } from '@vue/test-utils';
import BootstrapVue, { BModal } from 'bootstrap-vue';
import { createPinia, PiniaVuePlugin, setActivePinia } from 'pinia';
import CategoryEditModalComponent from '~/components/CategoryEditModal.vue';
import { useCategoryStore } from '~/stores/categories';
import { splitRegexPipe } from '~/util/validate';

// Tests call Options API members directly, which the Vue constructor type doesn't expose.
const CategoryEditModal: any = CategoryEditModalComponent;

// Enter inside the category edit modal should submit it, same as pressing OK.
// See https://github.com/ActivityWatch/aw-webui/issues/232
describe('CategoryEditModal handleEnter', () => {
  function ctx({ tagName = 'INPUT', ruleType = 'regex', validPattern = true } = {}) {
    const event = { target: { tagName }, preventDefault: jest.fn() };
    const vm = {
      editing: { rule: { type: ruleType } },
      validPattern,
      canSubmit: ruleType !== 'regex' || validPattern,
      handleSubmit: jest.fn(() => true),
      $emit: jest.fn(),
    };
    return { vm, event };
  }

  const handleEnter = (vm, event) => CategoryEditModal.methods.handleEnter.call(vm, event);

  test('submits when Enter is pressed in a text input', () => {
    const { vm, event } = ctx();
    handleEnter(vm, event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(vm.handleSubmit).toHaveBeenCalled();
    expect(vm.$emit).toHaveBeenCalledWith('ok');
  });

  test.each(['TEXTAREA', 'BUTTON', 'A', 'SELECT'])(
    'leaves Enter alone on <%s>, which handles it itself',
    tagName => {
      const { vm, event } = ctx({ tagName });
      handleEnter(vm, event);
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(vm.handleSubmit).not.toHaveBeenCalled();
    }
  );

  test('does not submit an invalid regex, mirroring the disabled OK button', () => {
    const { vm, event } = ctx({ validPattern: false });
    handleEnter(vm, event);
    expect(vm.handleSubmit).not.toHaveBeenCalled();
    expect(vm.$emit).not.toHaveBeenCalled();
  });

  test('submits a rule with no pattern to validate', () => {
    const { vm, event } = ctx({ ruleType: 'none', validPattern: false });
    handleEnter(vm, event);
    expect(vm.handleSubmit).toHaveBeenCalled();
  });

  test('does not emit ok when the submit rejected the edit', () => {
    // A rejected submit (e.g. an empty name) leaves the modal open; `ok` would
    // tell the category builder the draft was accepted and must not fire.
    const { vm, event } = ctx();
    vm.handleSubmit = jest.fn(() => false);
    handleEnter(vm, event);
    expect(vm.handleSubmit).toHaveBeenCalled();
    expect(vm.$emit).not.toHaveBeenCalled();
  });
});

describe('CategoryEditModal handleOk', () => {
  const handleOk = (vm, event) => CategoryEditModal.methods.handleOk.call(vm, event);

  function ctx(name) {
    const updateClass = jest.fn();
    const vm = {
      editing: {
        id: 1,
        name,
        parent: ['Work'],
        rule: { type: 'none' },
        match_fields: [],
        inherit_color: true,
        color: null,
        inherit_score: true,
        score: null,
        priority: null,
      },
      checkFormValidity: () => true,
      categoryStore: { updateClass },
      $nextTick: callback => callback(),
      $refs: { edit: { hide: jest.fn() } },
      $emit: jest.fn(),
      priorityFromInput: CategoryEditModal.methods.priorityFromInput,
      handleSubmit: CategoryEditModal.methods.handleSubmit,
    };
    return { vm, updateClass };
  }

  test('emits ok after the category is updated', () => {
    const { vm, updateClass } = ctx('Browser');
    handleOk(vm, { preventDefault: jest.fn() });
    expect(updateClass).toHaveBeenCalled();
    expect(vm.$emit).toHaveBeenCalledWith('ok');
  });

  test('a blank name updates nothing and emits no ok', () => {
    // `canSubmit` does not look at the name, so OK is enabled with an empty
    // name; the modal must then stay open and not report the draft accepted.
    const { vm, updateClass } = ctx('');
    handleOk(vm, { preventDefault: jest.fn() });
    expect(updateClass).not.toHaveBeenCalled();
    expect(vm.$emit).not.toHaveBeenCalled();
  });
});

describe('CategoryEditModal field-scoped rules', () => {
  const handleSubmit = vm => CategoryEditModal.methods.handleSubmit.call(vm);

  function ctx(match_fields) {
    const updateClass = jest.fn();
    const vm = {
      editing: {
        id: 1,
        name: 'Browser',
        parent: ['Work'],
        rule: { type: 'regex', regex: 'Firefox', select_keys: ['stale'] },
        match_fields,
        inherit_color: true,
        color: null,
        inherit_score: true,
        score: null,
        priority: null,
      },
      checkFormValidity: () => true,
      categoryStore: { updateClass },
      $nextTick: callback => callback(),
      $refs: { edit: { hide: jest.fn() } },
      priorityFromInput: CategoryEditModal.methods.priorityFromInput,
      storedRegex: CategoryEditModal.methods.storedRegex,
    };
    return {
      vm,
      updateClass,
    };
  }

  // activitywatch#1144: saving a rename/reparent re-renders the category tree, which can
  // destroy this modal before the deferred hide runs, leaving $refs.edit undefined.
  test('does not throw when the modal was destroyed before the deferred hide', () => {
    const { vm, updateClass } = ctx([]);
    vm.$refs = {} as any;
    expect(() => handleSubmit(vm)).not.toThrow();
    expect(updateClass).toHaveBeenCalled();
  });

  test('showModal is a no-op when the modal ref is gone', () => {
    expect(() => CategoryEditModal.methods.showModal.call({ $refs: {} })).not.toThrow();
  });

  test('blank field selection keeps the legacy unrestricted rule', () => {
    const { vm, updateClass } = ctx([]);
    handleSubmit(vm);
    expect(updateClass.mock.calls[0][0].rule.select_keys).toBeUndefined();
  });

  test('explicit field selection is preserved even when all offered fields are selected', () => {
    const { vm, updateClass } = ctx(['app', 'title']);
    handleSubmit(vm);
    expect(updateClass.mock.calls[0][0].rule.select_keys).toEqual(['app', 'title']);
  });

  test('only fields categorized by canonicalEvents are offered by default', () => {
    const fieldOptions = CategoryEditModal.computed.fieldOptions.call({
      editing: { match_fields: [] },
    });
    expect(fieldOptions).toEqual(['app', 'title']);
  });
});

describe('CategoryEditModal rule priority', () => {
  const handleSubmit = vm => CategoryEditModal.methods.handleSubmit.call(vm);

  function ctx({
    rule = { type: 'regex', regex: 'Firefox', weight: 7 } as Record<string, any>,
    priority = null,
  } = {}) {
    const updateClass = jest.fn();
    const vm: any = {
      editing: {
        id: 1,
        name: 'Browser',
        parent: ['Work'],
        rule,
        match_fields: [],
        inherit_color: true,
        color: null,
        inherit_score: true,
        score: null,
        priority,
      },
      checkFormValidity: () => true,
      categoryStore: { updateClass } as Record<string, any>,
      $nextTick: callback => callback(),
      $refs: { edit: { hide: jest.fn() } },
      priorityFromInput: CategoryEditModal.methods.priorityFromInput,
      priorityFromRule: CategoryEditModal.methods.priorityFromRule,
      storedRegex: CategoryEditModal.methods.storedRegex,
      categoryId: null as number | null,
    };
    return { vm, updateClass };
  }

  test('saves an integer priority on regex rules', () => {
    const { vm, updateClass } = ctx({ priority: '25' });
    handleSubmit(vm);
    expect(updateClass.mock.calls[0][0].rule.priority).toBe(25);
    expect(updateClass.mock.calls[0][0].rule.weight).toBeUndefined();
  });

  test('blank priority removes existing priority aliases', () => {
    const { vm, updateClass } = ctx({
      rule: { type: 'regex', regex: 'Firefox', priority: 3, weight: 7 },
      priority: '',
    });
    handleSubmit(vm);
    expect(updateClass.mock.calls[0][0].rule.priority).toBeUndefined();
    expect(updateClass.mock.calls[0][0].rule.weight).toBeUndefined();
  });

  test('resetModal shows the weight alias as priority', () => {
    const { vm } = ctx();
    vm.categoryId = 1;
    vm.categoryStore.get_category_by_id = () => ({
      id: 1,
      subname: 'Browser',
      parent: ['Work'],
      rule: { type: 'regex', regex: 'Firefox', weight: 7 },
      data: {},
    });

    CategoryEditModal.methods.resetModal.call(vm);

    expect(vm.editing.priority).toBe(7);
  });

  test.each([
    ['', null],
    ['0', 0],
    ['3', 3],
    ['-1', undefined],
    ['1.5', undefined],
  ])('parses priority %j as %j', (input, expected) => {
    expect(CategoryEditModal.methods.priorityFromInput(input)).toBe(expected);
  });

  test('negative priorities disable submission and cannot be saved', () => {
    const { vm, updateClass } = ctx({ priority: '-1' });
    vm.validPattern = true;
    vm.validScore = true;
    vm.validPriority = CategoryEditModal.computed.validPriority.call(vm);
    vm.canSubmit = CategoryEditModal.computed.canSubmit.call(vm);
    vm.checkFormValidity = () => CategoryEditModal.methods.checkFormValidity.call(vm);

    expect(vm.validPriority).toBe(false);
    expect(CategoryEditModal.computed.priorityState.call(vm)).toBe(false);
    expect(vm.canSubmit).toBe(false);
    handleSubmit(vm);
    expect(updateClass).not.toHaveBeenCalled();

    vm.handleSubmit = jest.fn();
    vm.$emit = jest.fn();
    const event = { target: { tagName: 'INPUT' }, preventDefault: jest.fn() };
    CategoryEditModal.methods.handleEnter.call(vm, event);
    expect(vm.handleSubmit).not.toHaveBeenCalled();
    expect(vm.$emit).not.toHaveBeenCalled();
  });

  test('decimal priorities are invalid', () => {
    const vm = {
      editing: { rule: { type: 'regex' }, priority: '1.5' },
      priorityFromInput: CategoryEditModal.methods.priorityFromInput,
    };

    expect(CategoryEditModal.computed.validPriority.call(vm)).toBe(false);
  });
});

describe('CategoryEditModal score round trip', () => {
  test.each([0, 0.5, -0.5, 1000, null, undefined])('reopens and saves score %s', score => {
    const updateClass = jest.fn();
    const category = {
      id: 2,
      subname: 'Child',
      parent: ['Parent'],
      rule: { type: 'none' },
      data: { score, color: '#123456' },
    };
    const vm: any = {
      categoryId: 2,
      categoryStore: { get_category_by_id: () => category, updateClass },
      priorityFromRule: CategoryEditModal.methods.priorityFromRule,
      checkFormValidity: () => true,
      $nextTick: callback => callback(),
      $refs: { edit: { hide: jest.fn() } },
    };

    CategoryEditModal.methods.resetModal.call(vm);
    expect(vm.editing.inherit_score).toBe(score === null || score === undefined);
    CategoryEditModal.methods.handleSubmit.call(vm);

    expect(updateClass).toHaveBeenCalledWith({
      id: 2,
      name: ['Parent', 'Child'],
      rule: { type: 'none' },
      data: { score: score ?? undefined, color: '#123456' },
    });
  });
});

describe('CategoryEditModal typed score', () => {
  // ActivityWatch/aw-webui#1317: a typed score reached the store as a string.
  test.each([
    ['5', 5],
    ['-1.5', -1.5],
    ['0', 0],
    [' 2 ', 2],
    // Phone decimal keypads in comma locales type "1,5".
    ['1,5', 1.5],
    ['-1,5', -1.5],
    ['-0,25', -0.25],
    ['0,125', 0.125],
    ['-0,125', -0.125],
  ])('saves typed score %j as %s', (typed, expected) => {
    const updateClass = jest.fn();
    const vm: any = {
      editing: {
        id: 2,
        name: 'Child',
        parent: ['Parent'],
        rule: { type: 'none' },
        color: '#123456',
        inherit_color: false,
        score: typed,
        inherit_score: false,
      },
      categoryStore: { updateClass },
      priorityFromRule: CategoryEditModal.methods.priorityFromRule,
      checkFormValidity: () => true,
      $nextTick: callback => callback(),
      $refs: { edit: { hide: jest.fn() } },
    };

    CategoryEditModal.methods.handleSubmit.call(vm);

    expect(updateClass.mock.calls[0][0].data.score).toBe(expected);
  });
});

describe('CategoryEditModal invalid legacy scores', () => {
  const invalidScores = ['abc', '5%', 'Infinity', '', '1,000', '-12,345', ' 123,456 ', '1,000e2'];
  test.each(invalidScores)('requires correction of stored score %j', stored => {
    const updateClass = jest.fn();
    const vm: any = {
      categoryId: 2,
      categoryStore: {
        get_category_by_id: () => ({
          id: 2,
          subname: 'Child',
          parent: ['Parent'],
          rule: { type: 'none' },
          data: { score: stored },
        }),
        updateClass,
      },
      priorityFromRule: CategoryEditModal.methods.priorityFromRule,
      checkFormValidity: () => CategoryEditModal.methods.checkFormValidity.call(vm),
      $nextTick: callback => callback(),
      $refs: { edit: { hide: jest.fn() } },
    };
    Object.defineProperty(vm, 'validScore', {
      get: () => CategoryEditModal.computed.validScore.call(vm),
    });

    CategoryEditModal.methods.resetModal.call(vm);
    expect(vm.editing.inherit_score).toBe(false);
    expect(vm.editing.score).toBe(stored);
    expect(CategoryEditModal.computed.canSubmit.call(vm)).toBe(false);
    CategoryEditModal.methods.handleSubmit.call(vm);
    expect(updateClass).not.toHaveBeenCalled();

    vm.editing.score = '2.5';
    expect(CategoryEditModal.computed.canSubmit.call(vm)).toBe(true);
    CategoryEditModal.methods.handleSubmit.call(vm);
    expect(updateClass.mock.calls[0][0].data.score).toBe(2.5);

    vm.editing.score = stored;
    vm.editing.inherit_score = true;
    expect(CategoryEditModal.computed.canSubmit.call(vm)).toBe(true);
    CategoryEditModal.methods.handleSubmit.call(vm);
    expect(updateClass.mock.calls[1][0].data.score).toBeUndefined();
  });
});

describe('CategoryEditModal regex round trip', () => {
  const handleSubmit = vm => CategoryEditModal.methods.handleSubmit.call(vm);

  function ctx(regex: string, rulePatterns?: string[]) {
    const updateClass = jest.fn();
    const vm: any = {
      editing: {
        id: 1,
        name: 'Browser',
        parent: ['Work'],
        rule: { type: 'regex', regex },
        rulePatterns: rulePatterns ?? splitRegexPipe(regex),
        originalRegex: regex,
        match_fields: [],
        inherit_color: true,
        color: null,
        inherit_score: true,
        score: null,
        priority: null,
      },
      storedRegex: CategoryEditModal.methods.storedRegex,
      checkFormValidity: () => true,
      categoryStore: { updateClass },
      $nextTick: callback => callback(),
      $refs: { edit: { hide: jest.fn() } },
      priorityFromInput: CategoryEditModal.methods.priorityFromInput,
    };
    return { vm, updateClass };
  }

  test('unedited save writes the original regex, including empty alternatives', () => {
    const original = 'a||b';
    const { vm, updateClass } = ctx(original);
    handleSubmit(vm);
    expect(updateClass.mock.calls[0][0].rule.regex).toBe(original);
  });

  test('unedited save keeps surrounding spaces in alternatives', () => {
    const original = 'Google Chrome| - YouTube';
    const { vm, updateClass } = ctx(original);
    handleSubmit(vm);
    expect(updateClass.mock.calls[0][0].rule.regex).toBe(original);
  });

  test('edited patterns are joined without trimming', () => {
    const { vm, updateClass } = ctx('foo|bar', ['Google Chrome', ' - YouTube']);
    handleSubmit(vm);
    expect(updateClass.mock.calls[0][0].rule.regex).toBe('Google Chrome| - YouTube');
  });
});

describe('CategoryEditModal mounted score round trip', () => {
  test.each([
    [0, 0, false],
    [' 2 ', 2, false],
    [' -1.5 ', -1.5, false],
    [' 0 ', 0, false],
    ['abc', 2.5, true],
    ['5%', 2.5, true],
    ['1,000', 1000, true],
    ['1,125', 1.125, true],
    ['1,125', 1125, true],
    ['', 2.5, true],
  ])('displays and saves stored score %j as %s', async (stored, expected, invalid) => {
    const localVue = createLocalVue();
    localVue.use(BootstrapVue);
    localVue.use(PiniaVuePlugin);
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useCategoryStore();
    store.load([
      { name: ['Parent'], rule: { type: 'none' }, data: { score: 1 } },
      { name: ['Parent', 'Child'], rule: { type: 'none' }, data: { score: stored as any } },
    ]);
    const categoryId = store.get_category(['Parent', 'Child']).id;
    const openModal = async () => {
      const wrapper = mount(CategoryEditModal, {
        localVue,
        pinia,
        propsData: { categoryId },
        mocks: {
          $t: key =>
            key === 'ui.categoryEditor.invalidScore' ? en.ui.categoryEditor.invalidScore : key,
        },
        stubs: {
          'color-picker': true,
          icon: true,
          'b-modal': { extends: BModal, props: { static: { default: true } } },
        },
      });
      await localVue.nextTick();
      await new Promise(resolve => setTimeout(resolve, 0));
      return wrapper;
    };

    let wrapper = await openModal();
    try {
      const scoreCheckbox = wrapper
        .findAllComponents({ name: 'BFormCheckbox' })
        .wrappers.find(checkbox => checkbox.text().includes('ui.categoryEditor.inheritScore'));
      expect((scoreCheckbox.find('input').element as HTMLInputElement).checked).toBe(false);
      const scoreInput = wrapper
        .findAllComponents({ name: 'BInputGroup' })
        .wrappers.find(group => group.text().includes('ui.categoryEditor.score'))
        .find('input');
      expect((scoreInput.element as HTMLInputElement).value).toBe(
        String(invalid ? stored : expected)
      );
      if (invalid) {
        expect(wrapper.text()).toContain(en.ui.categoryEditor.invalidScore);
        expect(wrapper.text()).toContain('1.125');
        expect(wrapper.text()).toContain('1125');
        expect(wrapper.text()).toContain('1,125');
        expect((wrapper.vm as any).canSubmit).toBe(false);
        (wrapper.vm.$refs.edit as any).$emit('ok', { preventDefault: jest.fn() });
        await localVue.nextTick();
        expect(store.get_category(['Parent', 'Child']).data.score).toBe(stored);
        await scoreInput.setValue(String(expected));
        expect((wrapper.vm as any).canSubmit).toBe(true);
      }
      (wrapper.vm.$refs.edit as any).$emit('ok', { preventDefault: jest.fn() });
      await localVue.nextTick();
      expect(store.get_category(['Parent', 'Child']).data.score).toBe(expected);
      expect(store.get_category_score(['Parent', 'Child'])).toBe(expected);

      wrapper.destroy();
      wrapper = await openModal();
      expect((wrapper.vm as any).editing.inherit_score).toBe(false);
      expect((wrapper.vm as any).editing.score).toBe(expected);
    } finally {
      wrapper.destroy();
    }
  });
});

describe('CategoryEditModal mounted regex rows', () => {
  async function openModal(regex: string) {
    const localVue = createLocalVue();
    localVue.use(BootstrapVue);
    localVue.use(PiniaVuePlugin);
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useCategoryStore();
    store.load([{ name: ['Browser'], rule: { type: 'regex', regex } }]);
    const wrapper = mount(CategoryEditModal, {
      localVue,
      pinia,
      propsData: { categoryId: store.get_category(['Browser']).id },
      stubs: {
        'color-picker': true,
        icon: true,
        'b-modal': { extends: BModal, props: { static: { default: true } } },
      },
    });
    await localVue.nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));
    const rows = () => wrapper.findAll('input[aria-label^="Pattern "]');
    const save = async () => {
      wrapper.findComponent(BModal).vm.$emit('ok', { preventDefault: jest.fn() });
      await localVue.nextTick();
      return store.get_category(['Browser']).rule.regex;
    };
    return { wrapper, rows, save };
  }

  test('editing another row and adding an unused row keep existing empty alternatives', async () => {
    const { wrapper, rows, save } = await openModal('Slack||Discord|');
    try {
      expect(rows().length).toBe(4);
      await rows().at(2).setValue('Discord Canary');
      await wrapper.find('button[aria-label="Add pattern"]').trigger('click');
      expect(rows().length).toBe(5);
      expect(await save()).toBe('Slack||Discord Canary|');
    } finally {
      wrapper.destroy();
    }
  });

  test('add, type, remove an earlier row, and save use the rendered controls', async () => {
    const { wrapper, rows, save } = await openModal('Slack||Discord');
    try {
      await wrapper.find('button[aria-label="Add pattern"]').trigger('click');
      await rows().at(3).setValue(' - YouTube');
      await wrapper.find('button[aria-label="Remove pattern 1"]').trigger('click');
      expect(rows().length).toBe(3);
      expect(await save()).toBe('|Discord| - YouTube');
    } finally {
      wrapper.destroy();
    }
  });

  test('cannot remove the last row', async () => {
    const { wrapper, rows } = await openModal('Firefox');
    try {
      const remove = wrapper.find('button[aria-label="Remove pattern 1"]');
      expect(remove.attributes('disabled')).toBeDefined();
      await remove.trigger('click');
      expect(rows().length).toBe(1);
    } finally {
      wrapper.destroy();
    }
  });
});
