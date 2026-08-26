import CategoryEditModal from '~/components/CategoryEditModal.vue';

// Enter inside the category edit modal should submit it, same as pressing OK.
// See https://github.com/ActivityWatch/aw-webui/issues/232
describe('CategoryEditModal handleEnter', () => {
  function ctx({ tagName = 'INPUT', ruleType = 'regex', validPattern = true } = {}) {
    const event = { target: { tagName }, preventDefault: jest.fn() };
    const vm = {
      editing: { rule: { type: ruleType } },
      validPattern,
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
