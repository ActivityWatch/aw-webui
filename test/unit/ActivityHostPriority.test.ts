import ActivityComponent from '~/views/activity/Activity.vue';

const Activity: any = ActivityComponent;

function vmFor() {
  return {
    selectableHosts: ['desktop', 'laptop', 'phone'],
    settingsStore: {
      multideviceHostOrder: ['desktop', 'laptop', 'phone', 'offline'],
      ensureLoaded: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      $patch: jest.fn(),
    },
    prioritySaving: false,
    isMultidevice: true,
    refresh: jest.fn(),
  };
}

describe('Activity overlap priority controls', () => {
  test('moves a device one position and saves the order without losing offline hosts', async () => {
    const vm = vmFor();
    await Activity.methods.moveHost.call(vm, 'phone', -1);
    expect(vm.settingsStore.update).toHaveBeenCalledWith({
      multideviceHostOrder: ['desktop', 'phone', 'laptop', 'offline'],
    });
    expect(vm.prioritySaving).toBe(false);
    expect(vm.refresh).toHaveBeenCalledTimes(1);
  });

  test('cannot move beyond either end or save concurrently', async () => {
    const vm = vmFor();
    await Activity.methods.moveHost.call(vm, 'desktop', -1);
    await Activity.methods.moveHost.call(vm, 'phone', 1);
    await Activity.methods.moveHost.call(vm, 'missing', -1);
    vm.prioritySaving = true;
    await Activity.methods.moveHost.call(vm, 'phone', -1);
    expect(vm.settingsStore.update).not.toHaveBeenCalled();
  });

  test('a failed save reports the failure and restores the prior order', async () => {
    const vm = vmFor();
    vm.settingsStore.update.mockRejectedValue(new Error('offline'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await Activity.methods.moveHost.call(vm, 'phone', -1);
    expect(vm.settingsStore.$patch).toHaveBeenCalledWith({
      multideviceHostOrder: ['desktop', 'laptop', 'phone', 'offline'],
    });
    expect((vm as any).priorityError).toBe(true);
    expect(vm.prioritySaving).toBe(false);
    expect(vm.refresh).not.toHaveBeenCalled();
    log.mockRestore();
  });

  test('priority changes reload multi-device results, not a single-device view', () => {
    const refresh = jest.fn();
    const handler = Activity.watch['settingsStore.multideviceHostOrder'].handler;
    handler.call({ isMultidevice: false, refresh });
    expect(refresh).not.toHaveBeenCalled();
    handler.call({ isMultidevice: true, prioritySaving: true, refresh });
    expect(refresh).not.toHaveBeenCalled();
    handler.call({ isMultidevice: true, prioritySaving: false, refresh });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
