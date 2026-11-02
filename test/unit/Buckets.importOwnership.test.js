const mockLoadBuckets = jest.fn();
jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({ bucketsByDevice: [], loadBuckets: mockLoadBuckets }),
}));
jest.mock('~/stores/server', () => ({ useServerStore: () => ({ info: null }) }));
jest.mock('~/util/awclient', () => ({ getStoredApiToken: jest.fn() }));
jest.mock('~/util/export', () => ({ androidExportFromUrl: jest.fn(), downloadBlob: jest.fn() }));

import { createLocalVue, shallowMount } from '@vue/test-utils';
import { BFormFile } from 'bootstrap-vue';
import Buckets from '~/views/Buckets.vue';
import asyncErrorCapturedMixin from '~/mixins/asyncErrorCaptured';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const file = name => new File(['{"buckets":{}}'], name, { type: 'application/json' });
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const FileInput = { name: 'FileInput', props: ['value'], template: '<input />' };

describe('bucket import selection ownership', () => {
  let wrapper, post, errors;

  beforeEach(async () => {
    mockLoadBuckets.mockReset().mockResolvedValue(undefined);
    post = jest.fn();
    errors = jest.fn(() => false);
    await mountBuckets();
  });

  async function mountBuckets(inputComponent = FileInput) {
    const localVue = createLocalVue();
    localVue.mixin(asyncErrorCapturedMixin);
    wrapper = shallowMount(
      { ...Buckets, methods: { ...Buckets.methods } },
      {
        localVue,
        sync: false,
        parentComponent: { errorCaptured: errors },
        mocks: { $aw: { req: { post } } },
        stubs: {
          'b-form-file': inputComponent,
          'b-card': true,
          'b-card-group': true,
          'b-modal': true,
          'b-alert': true,
          'b-button': true,
          'b-spinner': true,
          'aw-devonly': true,
          'aw-bucket-merge': true,
          'aw-bucket-validate': true,
          icon: true,
        },
      }
    );
    await flush();
    mockLoadBuckets.mockClear();
  }

  afterEach(() => wrapper.destroy());

  function select(value) {
    wrapper.findComponent(FileInput).vm.$emit('input', value);
  }

  function expectPending(selected) {
    expect(wrapper.vm.import_file).toBe(selected);
    expect(wrapper.find('b-spinner-stub').exists()).toBe(true);
    expect(wrapper.vm.import_success).toBe(false);
    expect(wrapper.vm.import_error).toBeNull();
  }

  test.each(['success', 'failure'])(
    'older %s cannot clear a pending newer import',
    async outcome => {
      const a = deferred();
      const b = deferred();
      const first = file('a.json');
      const second = file('b.json');
      post.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
      select(first);
      await flush();
      select(second);
      await flush();
      expect(post.mock.calls.map(call => call[1].get('buckets.json'))).toEqual([first, second]);
      if (outcome === 'success') a.resolve({});
      else a.reject(new Error('old import failed'));
      await flush();
      expectPending(second);
      expect(mockLoadBuckets).toHaveBeenCalledTimes(1);
      b.resolve({});
      await flush();
      expect(wrapper.vm.import_file).toBeNull();
      expect(wrapper.vm.import_success).toBe(true);
      expect(mockLoadBuckets).toHaveBeenCalledTimes(2);
    }
  );

  test.each(['success', 'failure'])('older %s cannot overwrite a newer failure', async outcome => {
    const a = deferred();
    const b = deferred();
    post.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    select(file('a.json'));
    await flush();
    select(file('b.json'));
    await flush();
    b.reject({ response: { data: { message: 'B was rejected' } } });
    await flush();
    if (outcome === 'success') a.resolve({});
    else a.reject({ response: { data: { message: 'A was rejected' } } });
    await flush();
    expect(wrapper.vm.import_success).toBe(false);
    expect(wrapper.vm.import_error).toBe('B was rejected');
    expect(wrapper.text()).toContain('B was rejected');
    expect(wrapper.vm.import_file).toBeNull();
    expect(mockLoadBuckets).toHaveBeenCalledTimes(2);
    expect(errors).not.toHaveBeenCalled();
  });

  test.each(['success', 'failure'])('clearing a selection ignores its later %s', async outcome => {
    const request = deferred();
    post.mockReturnValueOnce(request.promise);
    select(file('a.json'));
    await flush();
    select(null);
    await flush();
    if (outcome === 'success') request.resolve({});
    else request.reject(new Error('cleared import failed'));
    await flush();
    expect(wrapper.vm.import_file).toBeNull();
    expect(wrapper.vm.import_success).toBe(false);
    expect(wrapper.vm.import_error).toBeNull();
    expect(wrapper.find('b-spinner-stub').exists()).toBe(false);
    expect(mockLoadBuckets).toHaveBeenCalledTimes(1);
  });

  test.each(['success', 'failure'])('older %s cannot overwrite a newer success', async outcome => {
    const a = deferred();
    const b = deferred();
    post.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    select(file('a.json'));
    await flush();
    select(file('b.json'));
    await flush();
    b.resolve({});
    await flush();
    if (outcome === 'success') a.resolve({});
    else a.reject(new Error('old failure'));
    await flush();
    expect(wrapper.vm.import_success).toBe(true);
    expect(wrapper.vm.import_error).toBeNull();
    expect(wrapper.vm.import_file).toBeNull();
    expect(mockLoadBuckets).toHaveBeenCalledTimes(2);
  });

  test.each(['success', 'failure'])(
    'real file input retains %s after its automatic reset',
    async outcome => {
      wrapper.destroy();
      await mountBuckets(BFormFile);
      const request = deferred();
      post.mockReturnValueOnce(request.promise);
      const input = wrapper.find('input[type="file"]');
      const selected = file('import.json');
      Object.defineProperty(input.element, 'files', { value: [selected], configurable: true });
      await input.trigger('change');
      await flush();
      expect(post.mock.calls[0][1].get('buckets.json')).toBe(selected);
      expectPending(selected);
      if (outcome === 'success') request.resolve({});
      else request.reject(new Error('import failed'));
      await flush();
      expect(wrapper.findComponent(BFormFile).vm.files).toEqual([]);
      expect(wrapper.vm.import_file).toBeNull();
      expect(wrapper.vm.import_success).toBe(outcome === 'success');
      expect(wrapper.vm.import_error).toBe(
        outcome === 'success' ? null : wrapper.vm.$t('buckets.importFailedGeneric')
      );
      expect(post).toHaveBeenCalledTimes(1);
    }
  );

  test('an older successful refresh cannot clear a pending newer import', async () => {
    const refresh = deferred();
    const newer = deferred();
    mockLoadBuckets.mockReturnValueOnce(refresh.promise);
    post.mockResolvedValueOnce({}).mockReturnValueOnce(newer.promise);
    select(file('a.json'));
    await flush();
    const second = file('b.json');
    select(second);
    await flush();
    expectPending(second);
    refresh.resolve();
    await flush();
    expectPending(second);
    newer.resolve({});
    await flush();
    expect(wrapper.vm.import_success).toBe(true);
    expect(wrapper.vm.import_file).toBeNull();
  });

  test('clear and reselect of the same File creates a new operation even within one tick', async () => {
    const a = deferred();
    const b = deferred();
    const selected = file('retry.json');
    post.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    select(selected);
    await flush();
    select(null);
    select(selected);
    await flush();
    expect(post).toHaveBeenCalledTimes(2);
    a.resolve({});
    await flush();
    expectPending(selected);
    b.resolve({});
    await flush();
    expect(wrapper.vm.import_success).toBe(true);
    expect(wrapper.vm.import_file).toBeNull();
  });

  test('a rejected import stays failed with the global async mixin and can be retried', async () => {
    const selected = file('retry.json');
    const retry = deferred();
    post.mockRejectedValueOnce(new Error('network failure')).mockReturnValueOnce(retry.promise);
    select(selected);
    await flush();
    expect(wrapper.vm.import_error).toBe(wrapper.vm.$t('buckets.importFailedGeneric'));
    expect(wrapper.vm.import_success).toBe(false);
    expect(wrapper.vm.import_file).toBeNull();
    select(selected);
    await flush();
    expect(post).toHaveBeenCalledTimes(2);
    expectPending(selected);
    retry.resolve({});
    await flush();
    expect(wrapper.vm.import_error).toBeNull();
    expect(wrapper.vm.import_success).toBe(true);
    expect(wrapper.vm.import_file).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });

  test('refresh failure releases the current selection and reaches the error boundary', async () => {
    const failure = new Error('catalogue refresh failed');
    mockLoadBuckets.mockRejectedValueOnce(failure);
    post.mockResolvedValue({});
    const selected = file('retry.json');
    select(selected);
    await flush();
    expect(wrapper.vm.import_file).toBeNull();
    expect(wrapper.find('b-spinner-stub').exists()).toBe(false);
    expect(errors.mock.calls[0][0]).toBe(failure);
    select(selected);
    await flush();
    expect(post).toHaveBeenCalledTimes(2);
    expect(wrapper.vm.import_success).toBe(true);
  });

  test('an older refresh failure cannot release the next import', async () => {
    const refresh = deferred();
    const newer = deferred();
    const failure = new Error('old refresh failed');
    mockLoadBuckets.mockReturnValueOnce(refresh.promise);
    post.mockResolvedValueOnce({}).mockReturnValueOnce(newer.promise);
    select(file('a.json'));
    await flush();
    const second = file('b.json');
    select(second);
    await flush();
    refresh.reject(failure);
    await flush();
    expectPending(second);
    expect(errors.mock.calls[0][0]).toBe(failure);
    newer.resolve({});
    await flush();
    expect(wrapper.vm.import_file).toBeNull();
    expect(wrapper.vm.import_success).toBe(true);
  });
});
