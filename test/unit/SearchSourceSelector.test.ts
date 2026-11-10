import SelectorComponent from '~/components/SearchSourceSelector.vue';

const Selector: any = SelectorComponent;

const search = {
  pattern: 'example',
  start: '2026-10-16',
  stop: '2026-10-17',
  sources: ['aw-watcher-window_host', 'aw-watcher-web-firefox_host'],
};

function selectorVm(getEvents, limit = 500) {
  const vm: any = {
    ...Selector.data(),
    search,
    limit,
    modalId: 'search-source-selector',
    $aw: { getEvents },
    $bvModal: { show: jest.fn(), hide: jest.fn() },
    $emit: jest.fn(),
  };
  for (const [k, f] of Object.entries(Selector.methods)) vm[k] = (f as any).bind(vm);
  for (const [k, f] of Object.entries(Selector.computed)) {
    Object.defineProperty(vm, k, { get: (f as any).bind(vm) });
  }
  return vm;
}

const stored = (id, title) => ({
  id,
  timestamp: '2026-10-16T12:00:00Z',
  duration: 10,
  data: { app: 'Firefox', title },
});

describe('SearchSourceSelector', () => {
  test('opens on the requested bucket over the original search period', () => {
    const vm = selectorVm(jest.fn());
    vm.open('aw-watcher-web-firefox_host');
    expect(vm.bucketId).toBe('aw-watcher-web-firefox_host');
    expect(vm.start).toBe('2026-10-16T00:00');
    expect(vm.end).toBe('2026-10-17T00:00');
    expect(vm.$bvModal.show).toHaveBeenCalledWith('search-source-selector');
  });

  test('lists bounded stored events from the selected bucket, with the bucket attached', async () => {
    const getEvents = jest.fn().mockResolvedValue([stored(1, 'example'), stored(null, 'x')]);
    const vm = selectorVm(getEvents);
    vm.open();
    await vm.load();

    expect(getEvents).toHaveBeenCalledWith('aw-watcher-window_host', {
      start: new Date('2026-10-16T00:00'),
      end: new Date('2026-10-17T00:00'),
      limit: 500,
    });
    // A record without an ID is not editable and is not listed.
    expect(vm.candidates).toEqual([
      { ...stored(1, 'example'), bucketId: 'aw-watcher-window_host' },
    ]);
    expect(vm.truncated).toBe(false);
  });

  test('pattern filtering narrows the list but never selects for the user', async () => {
    const vm = selectorVm(
      jest.fn().mockResolvedValue([stored(1, 'An Example page'), stored(2, 'other')])
    );
    vm.open();
    await vm.load();
    expect(vm.shown.map(e => e.id)).toEqual([1]);
    vm.onlyMatching = false;
    expect(vm.shown.map(e => e.id)).toEqual([1, 2]);
    expect(vm.$emit).not.toHaveBeenCalled();
  });

  test('a list that reaches the limit is flagged as possibly incomplete', async () => {
    const vm = selectorVm(jest.fn().mockResolvedValue([stored(1, 'a'), stored(2, 'b')]), 2);
    vm.open();
    await vm.load();
    expect(vm.truncated).toBe(true);
  });

  test('an interval outside the search period is refused without a request', async () => {
    const getEvents = jest.fn();
    const vm = selectorVm(getEvents);
    vm.open();
    vm.start = '2026-10-15T00:00';
    await vm.load();
    expect(vm.outOfRange).toBe(true);
    expect(getEvents).not.toHaveBeenCalled();
  });

  test('a response for an invalidated list is dropped', async () => {
    let resolve;
    const vm = selectorVm(jest.fn().mockReturnValue(new Promise(r => (resolve = r))));
    vm.open();
    const loading = vm.load();
    vm.invalidate();
    resolve([stored(1, 'example')]);
    await loading;
    expect(vm.candidates).toBeNull();
    expect(vm.loading).toBe(false);
  });

  test('a load failure is shown and enables nothing', async () => {
    const vm = selectorVm(jest.fn().mockRejectedValue(new Error('no such bucket')));
    vm.open();
    await vm.load();
    expect(vm.error).toContain('no such bucket');
    expect(vm.candidates).toBeNull();
  });

  test('explicit selection hands the stored identity to the parent', async () => {
    const vm = selectorVm(jest.fn().mockResolvedValue([stored(7, 'example')]));
    vm.open('aw-watcher-web-firefox_host');
    await vm.load();
    vm.select(vm.shown[0]);
    expect(vm.$bvModal.hide).toHaveBeenCalledWith('search-source-selector');
    expect(vm.$emit).toHaveBeenCalledWith('select', {
      bucketId: 'aw-watcher-web-firefox_host',
      event: { id: 7, data: { app: 'Firefox', title: 'example' } },
    });
  });
});
