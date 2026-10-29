import { createLocalVue, shallowMount } from '@vue/test-utils';
import { createPinia, PiniaVuePlugin, setActivePinia } from 'pinia';
import Buckets from '~/views/Buckets.vue';
import { useBucketsStore } from '~/stores/buckets';

const mockGetBuckets = jest.fn();
const mockDeleteBucket = jest.fn();
jest.mock('~/util/awclient', () => ({
  ...jest.requireActual('~/util/awclient'),
  getClient: () => ({ getBuckets: mockGetBuckets, deleteBucket: mockDeleteBucket }),
}));

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);
const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));
const bucket = id => ({
  id,
  hostname: 'host',
  type: 'currentwindow',
  created: new Date('2026-10-28T10:00:00Z'),
  data: {},
});
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const notFound = id =>
  Object.assign(new Error(`Bucket ${id} does not exist`), {
    response: { status: 404, data: { message: `Bucket ${id} does not exist` } },
  });

// BootstrapVue is shallow-stubbed, but its modal's hidden event remains real.
const stubs = Object.fromEntries(
  [
    'b-card',
    'b-badge',
    'b-dropdown',
    'b-dropdown-item-button',
    'b-dropdown-item',
    'b-dropdown-divider',
    'b-modal',
    'b-button',
    'b-alert',
    'b-card-group',
    'b-form-file',
    'b-spinner',
    'icon',
    'router-link',
    'aw-devonly',
    'aw-bucket-merge',
    'aw-bucket-validate',
  ].map(name => [name, true])
);

describe('Buckets host deletion with the real bucket store', () => {
  let wrapper, store, catalogue, hideModal;

  const calls = () => mockDeleteBucket.mock.calls.map(([id]) => id);
  const modal = () => wrapper.find('b-modal-stub[id="delete-host-modal"]');
  const expectPending = ids => {
    expect(wrapper.vm.delete_host_selected.bucketIds).toEqual(ids);
    expect(wrapper.vm.delete_host_selected.bucketCount).toBe(ids.length);
    expect(
      modal()
        .findAll('li code')
        .wrappers.map(item => item.text())
    ).toEqual(ids);
  };
  const deleteOnServer = async id => {
    // aw-server-python does not acknowledge a second DELETE of the same ID.
    if (!catalogue.has(id)) throw notFound(id);
    catalogue.delete(id);
  };
  const openConfirmation = async () => {
    wrapper.vm.openDeleteHostModal(store.bucketsByDevice.host);
    await wrapper.vm.$nextTick();
  };
  const submit = () => wrapper.vm.deleteBucketsForSelectedHost();

  beforeEach(async () => {
    mockGetBuckets.mockReset();
    mockDeleteBucket.mockReset();
    catalogue = new Map(['A', 'B', 'C'].map(id => [id, bucket(id)]));
    mockGetBuckets.mockImplementation(async () => [...catalogue.values()]);
    mockDeleteBucket.mockImplementation(deleteOnServer);
    const pinia = createPinia();
    setActivePinia(pinia);
    wrapper = shallowMount(Buckets, {
      localVue,
      pinia,
      stubs,
      filters: { friendlytime: value => value },
    });
    await flushPromises();
    store = useBucketsStore(pinia);
    hideModal = jest.fn();
    wrapper.vm.$root.$on('bv::hide::modal', hideModal);
    await openConfirmation();
  });

  afterEach(() => {
    wrapper.destroy();
    jest.restoreAllMocks();
  });

  test.each(['A', 'B', 'C'])(
    'retains only unacknowledged IDs after %s fails once, and retries without deleting new arrivals',
    async failedId => {
      let failOnce = true;
      mockDeleteBucket.mockImplementation(async id => {
        if (id === failedId && failOnce) {
          failOnce = false;
          throw new Error(`Cannot delete ${id}`);
        }
        await deleteOnServer(id);
      });
      await submit();
      await wrapper.vm.$nextTick();

      const remaining = ['A', 'B', 'C'].slice(['A', 'B', 'C'].indexOf(failedId));
      const attempted = ['A', 'B', 'C'].slice(0, ['A', 'B', 'C'].indexOf(failedId) + 1);
      expect(calls()).toEqual(attempted);
      expectPending(remaining);
      expect(wrapper.vm.delete_host_error).toBe(`Cannot delete ${failedId}`);
      expect(modal().text()).toContain(`Cannot delete ${failedId}`);
      expect(wrapper.vm.deleting_host).toBe(false);
      expect(hideModal).not.toHaveBeenCalled();

      catalogue.set('D', bucket('D'));
      await store.loadBuckets();
      expectPending(remaining);
      await submit();
      expect(calls()).toEqual([...attempted, ...remaining]);
      expect([...catalogue.keys()]).toEqual(['D']);
      expect(store.buckets.map(b => b.id)).toEqual(['D']);
      expect(wrapper.vm.delete_host_error).toBeNull();
      expect(wrapper.vm.deleting_host).toBe(false);
      expect(hideModal).toHaveBeenCalledTimes(1);
      expect(hideModal).toHaveBeenCalledWith('delete-host-modal');
    }
  );

  test('keeps acknowledged progress even when catalogue reload fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockReturnValue(undefined);
    mockGetBuckets.mockRejectedValueOnce(new Error('Catalogue unavailable'));
    mockDeleteBucket
      .mockImplementationOnce(deleteOnServer)
      .mockRejectedValueOnce(new Error('B failed'));
    await submit();
    await wrapper.vm.$nextTick();

    expect(warn).toHaveBeenCalled();
    expect(calls()).toEqual(['A', 'B']);
    expectPending(['B', 'C']);
    expect(wrapper.vm.delete_host_error).toBe('B failed');
    // The stale catalogue still has A; retry must use confirmation progress instead.
    expect(store.buckets.map(b => b.id)).toEqual(['A', 'B', 'C']);
    catalogue.set('D', bucket('D'));
    await submit();
    expect(calls()).toEqual(['A', 'B', 'B', 'C']);
    expect(store.buckets.map(b => b.id)).toEqual(['D']);
    expect(hideModal).toHaveBeenCalledWith('delete-host-modal');
  });

  test('an already-absent bucket remains an explicit, retryable 404 failure', async () => {
    catalogue.delete('B');
    await submit();
    await wrapper.vm.$nextTick();

    expect(calls()).toEqual(['A', 'B']);
    expectPending(['B', 'C']);
    expect(wrapper.vm.delete_host_error).toBe('Bucket B does not exist');
    expect(modal().text()).toContain('Bucket B does not exist');
    expect(wrapper.vm.deleting_host).toBe(false);
    expect(hideModal).not.toHaveBeenCalled();

    await submit();
    expect(calls()).toEqual(['A', 'B', 'B']);
    expectPending(['B', 'C']);
    expect(hideModal).not.toHaveBeenCalled();
    expect(catalogue.has('C')).toBe(true);
  });

  test('all-success deletes exactly the confirmed IDs and closes the modal', async () => {
    catalogue.set('D', bucket('D'));
    await store.loadBuckets();
    expectPending(['A', 'B', 'C']);
    await submit();

    expect(calls()).toEqual(['A', 'B', 'C']);
    expect(store.buckets.map(b => b.id)).toEqual(['D']);
    expect(wrapper.vm.delete_host_error).toBeNull();
    expect(wrapper.vm.deleting_host).toBe(false);
    expect(hideModal).toHaveBeenCalledTimes(1);
    expect(hideModal).toHaveBeenCalledWith('delete-host-modal');
  });

  test('catalogue reload failure does not turn acknowledged success into deletion failure', async () => {
    jest.spyOn(console, 'warn').mockReturnValue(undefined);
    mockGetBuckets.mockRejectedValueOnce(new Error('Catalogue unavailable'));
    await submit();

    expect(calls()).toEqual(['A', 'B', 'C']);
    expect(catalogue.size).toBe(0);
    expect(wrapper.vm.delete_host_error).toBeNull();
    expect(wrapper.vm.deleting_host).toBe(false);
    expect(hideModal).toHaveBeenCalledWith('delete-host-modal');
  });

  test('duplicate confirmation while a request is pending does not submit again', async () => {
    const gate = deferred();
    mockDeleteBucket.mockImplementationOnce(async id => {
      await gate.promise;
      await deleteOnServer(id);
    });
    const operation = submit();
    expect(wrapper.vm.deleting_host).toBe(true);
    const duplicate = submit();
    try {
      expect(calls()).toEqual(['A']);
    } finally {
      gate.resolve();
      await Promise.all([operation, duplicate]);
    }
    expect(calls()).toEqual(['A', 'B', 'C']);
  });

  test('reopened confirmation cannot submit until the old operation settles', async () => {
    const gate = deferred();
    mockDeleteBucket.mockImplementationOnce(async id => {
      await gate.promise;
      await deleteOnServer(id);
    });
    const operation = submit();
    modal().vm.$emit('hidden');
    await openConfirmation();
    const confirmation = wrapper.vm.delete_host_selected;
    const duplicate = submit();
    try {
      expect(wrapper.vm.deleting_host).toBe(true);
      expect(calls()).toEqual(['A']);
    } finally {
      gate.resolve();
      await Promise.all([operation, duplicate]);
    }
    expect(wrapper.vm.deleting_host).toBe(false);
    expect(wrapper.vm.delete_host_selected).toBe(confirmation);
  });

  test.each(['success', 'error'])(
    'dismiss/reopen isolates errors and close events but reconciles acknowledged IDs after %s',
    async outcome => {
      const first = deferred();
      const second = deferred();
      mockDeleteBucket
        .mockImplementationOnce(async id => {
          await first.promise;
          await deleteOnServer(id);
        })
        .mockImplementationOnce(async id => {
          await second.promise;
          await deleteOnServer(id);
        });
      const operation = submit();
      expect(calls()).toEqual(['A']);
      modal().vm.$emit('hidden');
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.delete_host_selected).toBeNull();
      // Reopen the same host: overlapping IDs expose stale progress callbacks too.
      await openConfirmation();
      const confirmation = wrapper.vm.delete_host_selected;
      expect(wrapper.vm.deleting_host).toBe(true);
      expect(calls()).toEqual(['A']);

      first.resolve();
      await flushPromises();
      expect(calls()).toEqual(['A', 'B']);
      expect(wrapper.vm.delete_host_selected).toBe(confirmation);
      expectPending(['A', 'B', 'C']);
      expect(wrapper.vm.delete_host_error).toBeNull();
      expect(wrapper.vm.deleting_host).toBe(true);
      expect(hideModal).not.toHaveBeenCalled();

      if (outcome === 'error') second.reject(new Error('Old request failed'));
      else second.resolve();
      await operation;
      await wrapper.vm.$nextTick();
      expect(calls()).toEqual(outcome === 'error' ? ['A', 'B'] : ['A', 'B', 'C']);
      expect(wrapper.vm.delete_host_selected).toBe(confirmation);
      expectPending(outcome === 'error' ? ['B', 'C'] : []);
      expect(wrapper.vm.delete_host_error).toBeNull();
      expect(wrapper.vm.deleting_host).toBe(false);
      expect(hideModal).not.toHaveBeenCalled();

      await submit();
      expect(calls()).toEqual(outcome === 'error' ? ['A', 'B', 'B', 'C'] : ['A', 'B', 'C']);
      expect(catalogue.size).toBe(0);
      expect(wrapper.vm.delete_host_error).toBeNull();
      expect(hideModal).toHaveBeenCalledTimes(1);
    }
  );

  test.each([true, false])(
    'reconciles a refreshed confirmation by creation timestamp (recreated: %s)',
    async recreated => {
      const gate = deferred();
      mockDeleteBucket.mockImplementationOnce(deleteOnServer).mockImplementationOnce(async () => {
        await gate.promise;
        throw new Error('B failed');
      });
      const operation = submit();
      await flushPromises();
      expect(calls()).toEqual(['A', 'B']);
      expectPending(['B', 'C']);
      modal().vm.$emit('hidden');
      // A fresh object alone does not prove recreation: a stale catalogue response
      // may still contain the acknowledged bucket with the same creation timestamp.
      catalogue.set('A', {
        ...bucket('A'),
        created: recreated ? new Date('2026-10-29T10:00:00Z') : bucket('A').created,
      });
      await store.loadBuckets();
      await openConfirmation();
      expectPending(['A', 'B', 'C']);
      gate.resolve();
      await operation;
      await wrapper.vm.$nextTick();
      expectPending(recreated ? ['A', 'B', 'C'] : ['B', 'C']);
      expect(wrapper.vm.delete_host_error).toBeNull();
      expect(hideModal).not.toHaveBeenCalled();
      if (!recreated) catalogue.delete('A');
      await submit();
      expect(calls()).toEqual(recreated ? ['A', 'B', 'A', 'B', 'C'] : ['A', 'B', 'B', 'C']);
      expect(catalogue.size).toBe(0);
      expect(hideModal).toHaveBeenCalledTimes(1);
    }
  );

  test('does not retry a replacement deleted by an older in-flight ID-only request', async () => {
    const gate = deferred();
    mockDeleteBucket
      .mockImplementationOnce(async id => {
        await gate.promise;
        await deleteOnServer(id);
      })
      .mockRejectedValueOnce(new Error('B failed'));
    const operation = submit();
    expect(calls()).toEqual(['A']);
    catalogue.set('A', { ...bucket('A'), created: new Date('2026-10-29T10:00:00Z') });
    await store.loadBuckets();
    modal().vm.$emit('hidden');
    await openConfirmation();
    expectPending(['A', 'B', 'C']);
    gate.resolve();
    await operation;
    await wrapper.vm.$nextTick();

    expectPending(['B', 'C']);
    expect(wrapper.vm.delete_host_error).toBeNull();
    expect(hideModal).not.toHaveBeenCalled();
    await submit();
    expect(calls()).toEqual(['A', 'B', 'B', 'C']);
    expect(catalogue.size).toBe(0);
    expect(hideModal).toHaveBeenCalledTimes(1);
  });

  test.each([false, true])(
    'retries failed replacement reconciliation before deleting (replacement remains: %s)',
    async remains => {
      jest.spyOn(console, 'warn').mockReturnValue(undefined);
      const gate = deferred();
      mockDeleteBucket
        .mockImplementationOnce(async id => {
          await gate.promise;
          await deleteOnServer(id);
        })
        .mockRejectedValueOnce(new Error('B failed'));
      const operation = submit();
      catalogue.set('A', { ...bucket('A'), created: new Date('2026-10-29T10:00:00Z') });
      await store.loadBuckets();
      modal().vm.$emit('hidden');
      await openConfirmation();
      mockGetBuckets.mockRejectedValue(new Error('Catalogue unavailable'));
      gate.resolve();
      await operation;
      await wrapper.vm.$nextTick();
      expectPending(['A', 'B', 'C']);
      expect(wrapper.vm.delete_host_error).toBe('Catalogue unavailable');
      expect(wrapper.vm.deleting_host).toBe(false);
      await submit();
      expect(calls()).toEqual(['A', 'B']);
      expect(hideModal).not.toHaveBeenCalled();

      if (remains)
        catalogue.set('A', { ...bucket('A'), created: new Date('2026-10-29T10:00:00Z') });
      mockGetBuckets.mockImplementation(async () => [...catalogue.values()]);
      await submit();
      expect(calls()).toEqual(remains ? ['A', 'B', 'A', 'B', 'C'] : ['A', 'B', 'B', 'C']);
      expect(catalogue.size).toBe(0);
      expect(wrapper.vm.delete_host_error).toBeNull();
      expect(hideModal).toHaveBeenCalledTimes(1);
    }
  );

  test('reconciles the latest confirmation when it is reopened during revalidation', async () => {
    const deletion = deferred();
    const refresh = deferred();
    mockDeleteBucket
      .mockImplementationOnce(async id => {
        await deletion.promise;
        await deleteOnServer(id);
      })
      .mockRejectedValueOnce(new Error('B failed'));
    const operation = submit();
    catalogue.set('A', { ...bucket('A'), created: new Date('2026-10-29T10:00:00Z') });
    await store.loadBuckets();
    modal().vm.$emit('hidden');
    await openConfirmation();
    // Store's ordinary final refresh fails, then revalidation waits on a fresh read.
    jest.spyOn(console, 'warn').mockReturnValue(undefined);
    mockGetBuckets
      .mockRejectedValueOnce(new Error('Ordinary reload failed'))
      .mockImplementationOnce(() => refresh.promise);
    deletion.resolve();
    await flushPromises();
    expect(wrapper.vm.deleting_host).toBe(true);
    modal().vm.$emit('hidden');
    await openConfirmation();
    const latest = wrapper.vm.delete_host_selected;
    refresh.resolve([...catalogue.values()]);
    await operation;
    await wrapper.vm.$nextTick();
    expect(wrapper.vm.delete_host_selected).toBe(latest);
    expectPending(['B', 'C']);
    expect(wrapper.vm.delete_host_error).toBeNull();
    await submit();
    expect(calls()).toEqual(['A', 'B', 'B', 'C']);
    expect(catalogue.size).toBe(0);
  });

  test('reconciles deletions acknowledged before reopen even if catalogue reload fails', async () => {
    jest.spyOn(console, 'warn').mockReturnValue(undefined);
    const gate = deferred();
    mockDeleteBucket.mockImplementationOnce(deleteOnServer).mockImplementationOnce(async () => {
      await gate.promise;
      throw new Error('B failed');
    });
    const operation = submit();
    await flushPromises();
    expect(calls()).toEqual(['A', 'B']);
    expectPending(['B', 'C']);
    modal().vm.$emit('hidden');
    // New arrivals may be explicitly included in the reopened confirmation.
    catalogue.set('D', bucket('D'));
    store.update_buckets([...store.buckets, bucket('D')]);
    await openConfirmation();
    expectPending(['A', 'B', 'C', 'D']);
    mockGetBuckets.mockRejectedValueOnce(new Error('Catalogue unavailable'));
    gate.resolve();
    await operation;
    await wrapper.vm.$nextTick();
    expectPending(['B', 'C', 'D']);
    expect(wrapper.vm.delete_host_error).toBeNull();
    await submit();
    expect(calls()).toEqual(['A', 'B', 'B', 'C', 'D']);
    expect(catalogue.size).toBe(0);
    expect(hideModal).toHaveBeenCalledTimes(1);
  });
});
