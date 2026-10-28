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
    priorityRefreshPending: false,
    priorityRefreshForce: false,
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

  test('reordering visible devices preserves interleaved offline priority slots', async () => {
    const vm = vmFor();
    vm.settingsStore.multideviceHostOrder = [
      'offline-first',
      'desktop',
      'offline-middle',
      'laptop',
    ];
    await Activity.methods.moveHost.call(vm, 'phone', -1);
    expect(vm.settingsStore.update).toHaveBeenCalledWith({
      multideviceHostOrder: ['offline-first', 'desktop', 'offline-middle', 'phone', 'laptop'],
    });
  });

  test('a failed save restores the order loaded from the backend, not the initial default', async () => {
    const vm = vmFor();
    vm.settingsStore.multideviceHostOrder = [];
    vm.settingsStore.ensureLoaded.mockImplementation(async () => {
      vm.settingsStore.multideviceHostOrder = ['phone', 'desktop', 'laptop', 'offline'];
    });
    vm.settingsStore.update.mockRejectedValue(new Error('offline'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await Activity.methods.moveHost.call(vm, 'phone', -1);
      expect(vm.settingsStore.$patch).toHaveBeenCalledWith({
        multideviceHostOrder: ['phone', 'desktop', 'laptop', 'offline'],
      });
      expect(vm.prioritySaving).toBe(false);
    } finally {
      log.mockRestore();
    }
  });

  test('a settings load failure does not patch unloaded defaults over store state', async () => {
    const vm = vmFor();
    vm.settingsStore.ensureLoaded.mockRejectedValue(new Error('offline'));
    const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await Activity.methods.moveHost.call(vm, 'phone', -1);
      expect(vm.settingsStore.update).not.toHaveBeenCalled();
      expect(vm.settingsStore.$patch).not.toHaveBeenCalled();
      expect((vm as any).priorityError).toBe(true);
      expect(vm.prioritySaving).toBe(false);
    } finally {
      log.mockRestore();
    }
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

  test.each([false, true])(
    'navigation during a pending save refreshes the latest selection after settling (failure=%s)',
    async fails => {
      const vm: any = vmFor();
      let settle!: () => void;
      vm.settingsStore.update.mockImplementation(
        () =>
          new Promise<void>((resolve, reject) => {
            settle = () => (fails ? reject(new Error('offline')) : resolve());
          })
      );
      vm.periodLength = 'day';
      vm.timeperiod = { start: 'old', end: 'old-end' };
      vm.host = 'all';
      vm.refreshGeneration = 0;
      vm.activityStore = { ensure_loaded: jest.fn().mockResolvedValue(undefined) };
      vm.loadEarliestDate = jest.fn();
      vm.refresh = Activity.methods.refresh.bind(vm);
      const log = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        const saving = Activity.methods.moveHost.call(vm, 'phone', -1);
        await Promise.resolve();
        expect(vm.settingsStore.update).toHaveBeenCalledTimes(1);
        // Both route watchers and the manual refresh button must wait; a
        // following non-forced refresh must not lose the user's force request.
        vm.host = 'desktop';
        vm.isMultidevice = false;
        Activity.watch.host.call(vm);
        await vm.refresh(true);
        vm.timeperiod = { start: 'new', end: 'new-end' };
        Activity.watch.timeperiod.call(vm);
        expect(vm.activityStore.ensure_loaded).not.toHaveBeenCalled();
        settle();
        await saving;
        expect(vm.activityStore.ensure_loaded).toHaveBeenCalledTimes(1);
        expect(vm.activityStore.ensure_loaded).toHaveBeenCalledWith(
          expect.objectContaining({ host: 'desktop', timeperiod: vm.timeperiod, force: true })
        );
        expect(vm.prioritySaving).toBe(false);
        expect(vm.priorityRefreshPending).toBe(false);
        expect(vm.priorityRefreshForce).toBe(false);
      } finally {
        log.mockRestore();
      }
    }
  );

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
