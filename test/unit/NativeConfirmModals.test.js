import { createPinia, setActivePinia } from 'pinia';
import CategorizationSettings from '~/views/settings/CategorizationSettings.vue';
import Settings from '~/views/settings/Settings.vue';
import { useCategoryStore } from '~/stores/categories';

describe('BootstrapVue confirmation modals', () => {
  test.each([
    [false, false],
    [true, true],
  ])('delete category set confirmed=%s mutates=%s', async (confirmed, mutates) => {
    const categoryStore = {
      active_set_ids: ['work'],
      deleteSet: jest.fn(),
      save: jest.fn(),
    };
    const vm = {
      categoryStore,
      $bvModal: { msgBoxConfirm: jest.fn().mockResolvedValue(confirmed) },
    };

    await CategorizationSettings.methods.deleteActiveSet.call(vm);

    expect(vm.$bvModal.msgBoxConfirm).toHaveBeenCalledWith(
      'Delete category set "work"? This cannot be undone.',
      expect.objectContaining({ okTitle: 'Delete', okVariant: 'danger' })
    );
    expect(categoryStore.deleteSet).toHaveBeenCalledTimes(mutates ? 1 : 0);
    expect(categoryStore.save).toHaveBeenCalledTimes(mutates ? 1 : 0);
  });

  test.each([
    [false, 'current', false],
    [true, 'next', true],
  ])('switch category set confirmed=%s selects %s', async (confirmed, expected, discards) => {
    const categoryStore = {
      active_set_ids: ['current'],
      discardChanges: jest.fn(),
      switchToSet: jest.fn(),
    };
    const vm = {
      activeSetId: 'next',
      categoryStore,
      classes_unsaved_changes: true,
      $bvModal: { msgBoxConfirm: jest.fn().mockResolvedValue(confirmed) },
    };

    await CategorizationSettings.methods.onSetChange.call(vm, 'next');

    expect(vm.activeSetId).toBe(expected);
    expect(categoryStore.discardChanges).toHaveBeenCalledTimes(discards ? 1 : 0);
    expect(categoryStore.switchToSet).toHaveBeenCalledTimes(discards ? 1 : 0);
  });

  test.each([
    [false, false],
    [true, undefined],
  ])('settings route leave confirmed=%s calls next with %s', async (confirmed, nextArg) => {
    setActivePinia(createPinia());
    const categoryStore = useCategoryStore();
    categoryStore.classes_unsaved_changes = true;
    const next = jest.fn();
    const vm = {
      $t: jest.fn().mockReturnValue('Discard changes?'),
      $bvModal: { msgBoxConfirm: jest.fn().mockResolvedValue(confirmed) },
    };

    await Settings.beforeRouteLeave.call(vm, {}, {}, next);

    if (nextArg === undefined) expect(next).toHaveBeenCalledWith();
    else expect(next).toHaveBeenCalledWith(nextArg);
  });
});
