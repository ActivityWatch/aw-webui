import CategoryBuilder from '~/views/settings/CategoryBuilder.vue';

// "Ignore" used to only push to component state, so ignored words came back on
// reload. They now persist via the settings store.
// See https://github.com/ActivityWatch/aw-webui/issues/486
describe('CategoryBuilder ignored words', () => {
  function ctx(ignored = []) {
    const settingsStore = {
      category_builder_ignored_words: ignored,
      // $patch mirrors pinia's synchronous patch — update properties in place.
      $patch: jest.fn(state => Object.assign(settingsStore, state)),
      update: jest.fn(async state => Object.assign(settingsStore, state)),
    };
    const vm = { settingsStore, show_ignored: true, fetchWords: jest.fn() };
    // The component reads ignored_words through this computed.
    Object.defineProperty(vm, 'ignored_words', {
      get: () => CategoryBuilder.computed.ignored_words.call(vm),
    });
    return vm;
  }
  const call = (name, vm, ...args) => CategoryBuilder.methods[name].call(vm, ...args);

  test('ignoreWord persists the word to settings', async () => {
    const vm = ctx(['foo']);
    await call('ignoreWord', vm, 'bar');
    expect(vm.settingsStore.update).toHaveBeenCalledWith({
      category_builder_ignored_words: ['foo', 'bar'],
    });
    expect(vm.ignored_words).toEqual(['foo', 'bar']);
  });

  test('ignoreWord does not duplicate an already-ignored word', async () => {
    const vm = ctx(['foo']);
    await call('ignoreWord', vm, 'foo');
    expect(vm.settingsStore.update).not.toHaveBeenCalled();
  });

  test('unignoreWord removes the word and refetches so it can reappear', async () => {
    const vm = ctx(['foo', 'bar']);
    await call('unignoreWord', vm, 'foo');
    expect(vm.settingsStore.update).toHaveBeenCalledWith({
      category_builder_ignored_words: ['bar'],
    });
    expect(vm.fetchWords).toHaveBeenCalled();
  });

  test('resetIgnoredWords clears the list and refetches', async () => {
    const vm = ctx(['foo', 'bar']);
    await call('resetIgnoredWords', vm);
    expect(vm.settingsStore.update).toHaveBeenCalledWith({ category_builder_ignored_words: [] });
    expect(vm.show_ignored).toBe(false);
    expect(vm.fetchWords).toHaveBeenCalled();
  });

  test('missing setting reads as no ignored words', () => {
    const vm = ctx(undefined);
    expect(vm.ignored_words).toEqual([]);
  });

  test('ignoreWord patches store synchronously so overlapping calls read the updated list', async () => {
    // Simulate two rapid Ignore clicks before either async update resolves.
    // The second call must see the first word in the list, not the stale snapshot.
    const vm = ctx([]);
    // Fire both ignores without awaiting the first one
    const p1 = call('ignoreWord', vm, 'foo');
    const p2 = call('ignoreWord', vm, 'bar');
    await Promise.all([p1, p2]);
    // Both words must end up in the final list — neither should be lost.
    expect(vm.ignored_words).toEqual(expect.arrayContaining(['foo', 'bar']));
    expect(vm.ignored_words).toHaveLength(2);
  });

  test('ignoreWord calls $patch synchronously before the async update', async () => {
    const vm = ctx(['existing']);
    await call('ignoreWord', vm, 'new');
    // $patch must have been called (synchronous guard against read-modify-write race)
    expect(vm.settingsStore.$patch).toHaveBeenCalledWith({
      category_builder_ignored_words: ['existing', 'new'],
    });
  });
});
