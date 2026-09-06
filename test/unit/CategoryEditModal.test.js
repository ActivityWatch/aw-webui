import CategoryEditModal from '~/components/CategoryEditModal.vue';

// Enter inside the category edit modal should submit it, same as pressing OK.
// See https://github.com/ActivityWatch/aw-webui/issues/232
describe('CategoryEditModal handleEnter', () => {
  function ctx({ tagName = 'INPUT', ruleType = 'regex', validPattern = true } = {}) {
    const event = { target: { tagName }, preventDefault: jest.fn() };
    const vm = {
      editing: { rule: { type: ruleType } },
      validPattern,
      canSubmit: ruleType !== 'regex' || validPattern,
      handleSubmit: jest.fn(),
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
    };
    return {
      vm,
      updateClass,
    };
  }

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

  function ctx({ rule = { type: 'regex', regex: 'Firefox', weight: 7 }, priority = null } = {}) {
    const updateClass = jest.fn();
    const vm = {
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
      categoryStore: { updateClass },
      $nextTick: callback => callback(),
      $refs: { edit: { hide: jest.fn() } },
      priorityFromInput: CategoryEditModal.methods.priorityFromInput,
      priorityFromRule: CategoryEditModal.methods.priorityFromRule,
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

  test('decimal priorities are invalid', () => {
    const vm = {
      editing: { rule: { type: 'regex' }, priority: '1.5' },
      priorityFromInput: CategoryEditModal.methods.priorityFromInput,
    };

    expect(CategoryEditModal.computed.validPriority.call(vm)).toBe(false);
  });
});
