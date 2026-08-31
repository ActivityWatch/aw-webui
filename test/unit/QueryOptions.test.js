import moment from 'moment';
import { createPinia, setActivePinia } from 'pinia';
import { shallowMount } from '@vue/test-utils';
import QueryOptions from '~/components/QueryOptions.vue';

const mockEnsureLoaded = jest.fn().mockResolvedValue(undefined);

jest.mock('~/stores/buckets', () => ({
  useBucketsStore: () => ({
    ensureLoaded: mockEnsureLoaded,
    hosts: ['laptop'],
  }),
}));

describe('QueryOptions', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockEnsureLoaded.mockClear();
  });

  test('normalizes Moment date props for native date inputs', async () => {
    const wrapper = shallowMount(QueryOptions, {
      propsData: {
        queryOptions: {
          start: moment('2026-08-15'),
          stop: moment('2026-08-16'),
        },
      },
      stubs: {
        'b-form-group': { template: '<div><slot /></div>' },
        'b-form-select': true,
        'b-form-checkbox': true,
      },
    });

    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const dateInputs = wrapper.findAll('input[type="date"]');
    expect(dateInputs).toHaveLength(2);
    expect(dateInputs.at(0).element.value).toBe('2026-08-15');
    expect(dateInputs.at(1).element.value).toBe('2026-08-16');
  });
});
