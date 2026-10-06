const mockGet = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    req: { get: mockGet, post: jest.fn() },
  }),
}));

import { shallowMount } from '@vue/test-utils';
import AwNotifySettings from '~/views/settings/AwNotifySettings.vue';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('AwNotifySettings', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  // aw-server-rust returns 200 with a null body for a setting that was never saved.
  test.each([
    ['a null response', () => mockGet.mockResolvedValue({ data: null })],
    ['a 404 response', () => mockGet.mockRejectedValue({ response: { status: 404 } })],
  ])('falls back to default alerts on %s', async (_name, setup) => {
    setup();
    const wrapper = shallowMount(AwNotifySettings);
    await flushPromises();

    expect(wrapper.vm.error).toBe('');
    expect(wrapper.vm.alerts.map(a => a.category)).toEqual(['All', 'Work']);
  });

  test('shows an error for a malformed saved setting', async () => {
    mockGet.mockResolvedValue({ data: { alerts: 'bad' } });
    const wrapper = shallowMount(AwNotifySettings);
    await flushPromises();

    expect(wrapper.vm.error).toMatch('unsupported format');
  });

  test('reflects enabled: true from saved config', async () => {
    mockGet.mockResolvedValue({
      data: { enabled: true, alerts: [] },
    });
    const wrapper = shallowMount(AwNotifySettings);
    await flushPromises();

    expect(wrapper.vm.enabled).toBe(true);
  });

  test('defaults enabled to false when the key is absent', async () => {
    mockGet.mockResolvedValue({ data: { alerts: [] } });
    const wrapper = shallowMount(AwNotifySettings);
    await flushPromises();

    expect(wrapper.vm.enabled).toBe(false);
  });
});
