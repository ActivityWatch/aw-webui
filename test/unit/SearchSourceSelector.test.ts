import { execFileSync } from 'child_process';
import path from 'path';
import { shallowMount } from '@vue/test-utils';
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
    $t: key => key,
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
  if (process.env.TZ !== 'Europe/Stockholm') {
    test('replays selector DST cases in Europe/Stockholm', () => {
      expect(() =>
        execFileSync(
          process.execPath,
          [
            require.resolve('jest/bin/jest'),
            '--selectProjects',
            'jsdom',
            '--runInBand',
            '--coverage=false',
            '--runTestsByPath',
            __filename,
            '--testNamePattern=DST selector',
          ],
          {
            cwd: path.resolve(__dirname, '../..'),
            env: { ...process.env, TZ: 'Europe/Stockholm' },
            stdio: 'pipe',
            timeout: 60000,
          }
        )
      ).not.toThrow();
    }, 65000);
  }

  const describeDst = process.env.TZ === 'Europe/Stockholm' ? describe : describe.skip;
  describeDst('DST selector', () => {
    test('requires an explicit occurrence and requests the selected repeated hour', async () => {
      const getEvents = jest.fn().mockResolvedValue([]);
      const vm = selectorVm(getEvents);
      vm.search = { ...search, start: '2026-10-25', stop: '2026-10-26' };
      vm.open();
      vm.start = '2026-10-25T02:30';
      vm.end = '2026-10-25T02:45';
      await vm.load();
      expect(getEvents).not.toHaveBeenCalled();
      expect(vm.error).toBe('activity.intervalAmbiguousTime');
      vm.startInstant = '2026-10-25T01:30:00Z';
      vm.endInstant = '2026-10-25T01:45:00Z';
      await vm.load();
      expect(getEvents).toHaveBeenCalledWith(search.sources[0], {
        start: new Date('2026-10-25T01:30:00Z'),
        end: new Date('2026-10-25T01:45:00Z'),
        limit: 500,
      });
    });

    test('preserves an original second-occurrence search bound on open', async () => {
      const getEvents = jest.fn().mockResolvedValue([]);
      const vm = selectorVm(getEvents);
      vm.search = { ...search, start: '2026-10-25T01:30:00Z', stop: '2026-10-25T01:45:00Z' };
      vm.open();
      await vm.load();
      expect(getEvents).toHaveBeenCalledWith(search.sources[0], {
        start: new Date(vm.search.start),
        end: new Date(vm.search.stop),
        limit: 500,
      });
    });

    test('rendered wall-time edits clear the occurrence and expose offset choices', async () => {
      const wrapper = shallowMount(SelectorComponent, {
        propsData: { search: { ...search, start: '2026-10-25', stop: '2026-10-26' } },
        mocks: { $bvModal: { show: jest.fn() } },
        stubs: {
          'b-modal': true,
          'b-input': true,
          'b-form-select': {
            name: 'b-form-select',
            props: ['options', 'value'],
            template: '<select />',
          },
          'b-button': true,
          'b-form-checkbox': true,
          'b-alert': true,
        },
      });
      const vm = wrapper.vm as any;
      vm.open();
      await wrapper.vm.$nextTick();
      wrapper.findAll('b-input-stub').at(0).vm.$emit('input', '2026-10-25T02:30');
      await wrapper.vm.$nextTick();
      expect(vm.startInstant).toBeNull();
      const choices = wrapper.findAllComponents({ name: 'b-form-select' }).at(1);
      expect(choices.props('options')).toEqual(vm.occurrenceOptions(vm.startOptions));
      choices.vm.$emit('input', '2026-10-25T01:30:00Z');
      await wrapper.vm.$nextTick();
      expect(vm.startInstant).toBe('2026-10-25T01:30:00Z');
      expect(vm.occurrenceOptions(vm.startOptions)).toEqual([
        expect.objectContaining({ value: null, disabled: true }),
        { value: '2026-10-25T00:30:00Z', text: '02:30:00 +02:00' },
        { value: '2026-10-25T01:30:00Z', text: '02:30:00 +01:00' },
      ]);
      wrapper.destroy();
    });

    test('refuses a nonexistent spring-forward time', async () => {
      const getEvents = jest.fn().mockResolvedValue([]);
      const vm = selectorVm(getEvents);
      vm.search = { ...search, start: '2026-03-29', stop: '2026-03-30' };
      vm.open();
      vm.start = '2026-03-29T02:30';
      await vm.load();
      expect(getEvents).not.toHaveBeenCalled();
      expect(vm.error).toBe('activity.intervalNonexistentTime');
    });
  });

  test('opens on the requested bucket over the original search period', () => {
    const vm = selectorVm(jest.fn());
    vm.open('aw-watcher-web-firefox_host');
    expect(vm.bucketId).toBe('aw-watcher-web-firefox_host');
    expect(vm.start).toBe('2026-10-16T00:00:00');
    expect(vm.end).toBe('2026-10-17T00:00:00');
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

  test.each(['bucketId', 'start', 'end', 'startInstant', 'endInstant'])(
    'changing %s drops the listed and pending candidates',
    async field => {
      expect(Object.keys(Selector.watch)).toContain(field);
      let resolve;
      const vm = selectorVm(
        jest
          .fn()
          .mockResolvedValueOnce([stored(1, 'example')])
          .mockReturnValueOnce(new Promise(r => (resolve = r)))
      );
      vm.open();
      await vm.load();
      expect(vm.candidates).toHaveLength(1);
      const loading = vm.load();
      Selector.watch[field].call(vm);
      expect(vm.candidates).toBeNull();
      resolve([stored(2, 'example')]);
      await loading;
      expect(vm.candidates).toBeNull();
    }
  );
});
