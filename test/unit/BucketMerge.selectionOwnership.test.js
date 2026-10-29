import { createLocalVue, shallowMount } from '@vue/test-utils';
import BucketMerge from '~/components/BucketMerge.vue';
import asyncErrorCaptured from '~/mixins/asyncErrorCaptured';

const mockGetBuckets = jest.fn();
const mockGetEvents = jest.fn();
const mockInsertEvents = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    getBuckets: mockGetBuckets,
    getEvents: mockGetEvents,
    insertEvents: mockInsertEvents,
  }),
}));

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
const event = (id, hour) => ({
  id,
  timestamp: `2026-10-29T${hour}:00:00Z`,
  duration: 10,
});
const source = [event('source', '01')];
const destination = [event('destination', '02')];
const replacement = [event('replacement', '03')];

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const Button = {
  props: ['disabled'],
  template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
};

let wrapper;
let errors;

async function mountLoaded() {
  // Include the production mixin: wrapped async methods swallow rejections.
  // A failed fetch must still leave the merge inputs unavailable.
  const localVue = createLocalVue();
  localVue.mixin(asyncErrorCaptured);
  errors = [];
  localVue.config.errorHandler = error => errors.push(error);
  mockGetBuckets.mockResolvedValue({ A: {}, B: {}, D: {} });
  mockGetEvents.mockImplementation(async id => (id === 'A' ? source : destination));
  mockInsertEvents.mockResolvedValue([]);
  wrapper = shallowMount(BucketMerge, {
    localVue,
    parentComponent: {
      errorCaptured(error) {
        errors.push(error);
        return false;
      },
    },
    stubs: {
      'b-button': Button,
      'b-row': true,
      'b-col': true,
      'b-form-select': true,
    },
  });
  await wrapper.setData({ bucket_from: 'A', bucket_to: 'D' });
  await flushPromises();
  expect(wrapper.vm.validate).toBe(true);
  expect(wrapper.find('button').element.disabled).toBe(false);
}

async function expectBlocked() {
  expect(wrapper.vm.validate).toBe(false);
  await wrapper.vm.merge();
  expect(mockInsertEvents).not.toHaveBeenCalled();
  await wrapper.vm.$nextTick();
  expect(wrapper.find('button').element.disabled).toBe(true);
}

afterEach(() => {
  if (wrapper) wrapper.destroy();
  jest.resetAllMocks();
});

describe.each([
  ['source', 'bucket_from', 'events_from'],
  ['destination', 'bucket_to', 'events_to'],
])('BucketMerge %s selection ownership', (_side, selection, events) => {
  test('blocks immediately, while the replacement load is pending, and after failure', async () => {
    await mountLoaded();
    const load = deferred();
    mockGetEvents.mockReturnValueOnce(load.promise);

    // The write boundary must be safe even before Vue runs the watcher.
    wrapper.vm[selection] = 'B';
    await expectBlocked();
    expect(wrapper.vm[events]).toBeNull();

    const failure = new Error('load failed');
    load.reject(failure);
    await flushPromises();
    await expectBlocked();
    expect(errors).toContain(failure);

    // Clear and reselect to retry the same bucket after a failed request.
    await wrapper.setData({ [selection]: null });
    mockGetEvents.mockResolvedValueOnce(replacement);
    await wrapper.setData({ [selection]: 'B' });
    await flushPromises();
    expect(wrapper.vm.validate).toBe(true);
    await wrapper.vm.merge();
    expect(mockInsertEvents).toHaveBeenCalledWith(
      selection === 'bucket_to' ? 'B' : 'D',
      selection === 'bucket_from' ? replacement : source
    );
  });

  test('ignores an older response that finishes after the newest selection', async () => {
    await mountLoaded();
    const older = deferred();
    const newer = deferred();
    mockGetEvents.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    await wrapper.setData({ [selection]: 'B' });
    await wrapper.setData({ [selection]: 'C' });

    newer.resolve(replacement);
    await flushPromises();
    older.resolve(source);
    await flushPromises();
    expect(wrapper.vm[events]).toEqual(replacement);
    expect(wrapper.vm.validate).toBe(true);
    await wrapper.vm.merge();
    expect(mockInsertEvents).toHaveBeenCalledWith(
      selection === 'bucket_to' ? 'C' : 'D',
      selection === 'bucket_from' ? replacement : source
    );
  });

  test('does not accept the first response after C → B → C', async () => {
    await mountLoaded();
    const firstC = deferred();
    const middleB = deferred();
    const lastC = deferred();
    mockGetEvents
      .mockReturnValueOnce(firstC.promise)
      .mockReturnValueOnce(middleB.promise)
      .mockReturnValueOnce(lastC.promise);
    await wrapper.setData({ [selection]: 'C' });
    await wrapper.setData({ [selection]: 'B' });
    await wrapper.setData({ [selection]: 'C' });
    firstC.resolve(source);
    middleB.resolve(destination);
    await flushPromises();
    await expectBlocked();
    lastC.resolve(replacement);
    await flushPromises();
    expect(wrapper.vm[events]).toEqual(replacement);
    expect(wrapper.vm.validate).toBe(true);
  });

  test('an older failed load cannot invalidate a newer successful selection', async () => {
    await mountLoaded();
    const older = deferred();
    mockGetEvents.mockReturnValueOnce(older.promise).mockResolvedValueOnce(replacement);
    await wrapper.setData({ [selection]: 'B' });
    await wrapper.setData({ [selection]: 'C' });
    await flushPromises();
    older.reject(new Error('older load failed'));
    await flushPromises();
    expect(errors).toHaveLength(1);
    expect(wrapper.vm[events]).toEqual(replacement);
    expect(wrapper.vm.validate).toBe(true);
  });

  test('clearing the selection does not fetch or accept a late response', async () => {
    await mountLoaded();
    const load = deferred();
    mockGetEvents.mockReturnValueOnce(load.promise);
    await wrapper.setData({ [selection]: 'B' });
    await wrapper.setData({ [selection]: null });
    load.resolve(replacement);
    await flushPromises();
    expect(mockGetEvents).not.toHaveBeenCalledWith(null);
    expect(wrapper.vm[events]).toBeNull();
    await expectBlocked();
  });
});

test('waits for both current selections, then inserts the current source into the current destination', async () => {
  await mountLoaded();
  const from = deferred();
  const to = deferred();
  mockGetEvents.mockReturnValueOnce(from.promise).mockReturnValueOnce(to.promise);
  await wrapper.setData({ bucket_from: 'B', bucket_to: 'C' });
  from.resolve(replacement);
  await flushPromises();
  await expectBlocked();
  to.resolve(destination);
  await flushPromises();
  expect(wrapper.vm.validate).toBe(true);
  await wrapper.vm.merge();
  expect(mockInsertEvents).toHaveBeenCalledTimes(1);
  expect(mockInsertEvents).toHaveBeenCalledWith('C', replacement);
});

test('the write method refuses identical buckets even after their events load', async () => {
  await mountLoaded();
  mockGetEvents.mockResolvedValueOnce([]);
  await wrapper.setData({ bucket_to: 'A' });
  await flushPromises();
  expect(wrapper.vm.events_to).toEqual([]);
  await expectBlocked();
});

test('the write method refuses overlapping current inputs', async () => {
  await mountLoaded();
  mockGetEvents.mockResolvedValueOnce([...source]);
  await wrapper.setData({ bucket_to: 'B' });
  await flushPromises();
  expect(wrapper.vm.overlappingEvents).toHaveLength(1);
  await expectBlocked();
});

test('empty successfully loaded buckets are valid disjoint inputs', async () => {
  await mountLoaded();
  mockGetEvents.mockResolvedValue([]);
  await wrapper.setData({ bucket_from: 'B', bucket_to: 'C' });
  await flushPromises();
  expect(wrapper.vm.validate).toBe(true);
  await wrapper.vm.merge();
  expect(mockInsertEvents).toHaveBeenCalledWith('C', []);
});
