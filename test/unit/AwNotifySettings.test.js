const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({
    req: { get: mockGet, post: mockPost },
  }),
}));

import { shallowMount } from '@vue/test-utils';
import AwNotifySettings from '~/views/settings/AwNotifySettings.vue';

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('AwNotifySettings', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockPost.mockResolvedValue({});
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

  test('save() writes enabled: true and preserves existing alerts', async () => {
    const savedAlert = { label: null, category: 'All', thresholds_minutes: [60], positive: false };
    mockGet.mockResolvedValue({ data: { enabled: false, alerts: [savedAlert] } });
    const wrapper = shallowMount(AwNotifySettings);
    await flushPromises();

    wrapper.vm.enabled = true;
    await wrapper.vm.save();

    expect(wrapper.vm.error).toBe('');
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('aw-notify'),
      expect.objectContaining({
        enabled: true,
        alerts: expect.arrayContaining([expect.objectContaining({ category: 'All' })]),
      }),
      expect.anything()
    );
  });

  test('save() with enabled: false succeeds even when a hidden alert edit is invalid', async () => {
    const savedAlert = { label: null, category: 'Work', thresholds_minutes: [120], positive: true };
    mockGet.mockResolvedValue({ data: { enabled: true, alerts: [savedAlert] } });
    const wrapper = shallowMount(AwNotifySettings);
    await flushPromises();

    // Simulate a pending invalid edit in the (now-hidden) alert row
    wrapper.vm.alerts[0].thresholdStr = 'not-a-number';
    wrapper.vm.enabled = false;
    await wrapper.vm.save();

    expect(wrapper.vm.error).toBe('');
    // The hidden invalid edit must be ignored: the payload carries the
    // last-saved snapshot, not the pending form state.
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('aw-notify'),
      expect.objectContaining({ enabled: false, alerts: [savedAlert] }),
      expect.anything()
    );
  });

  test('save() with enabled: false discards even valid unsaved edits (reverts to last-saved state)', async () => {
    // Intentional contract: disabling sends the last-saved snapshot, so any
    // pending edit — valid or not — is dropped. Documented in save().
    const savedAlert = { label: null, category: 'Work', thresholds_minutes: [120], positive: true };
    mockGet.mockResolvedValue({ data: { enabled: true, alerts: [savedAlert] } });
    const wrapper = shallowMount(AwNotifySettings);
    await flushPromises();

    // A valid pending edit that was never saved
    wrapper.vm.alerts[0].thresholdStr = '30';
    wrapper.vm.enabled = false;
    await wrapper.vm.save();

    expect(wrapper.vm.error).toBe('');
    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('aw-notify'),
      expect.objectContaining({ enabled: false, alerts: [savedAlert] }),
      expect.anything()
    );
  });

  test('save() with enabled: false retains alerts added in the same session', async () => {
    // Regression: this.config was never updated after a successful save, so a
    // disable-save on the same page would send this.config.alerts (stale load),
    // not the newly-added alerts.
    mockGet.mockResolvedValue({ data: { enabled: true, alerts: [] } });
    const wrapper = shallowMount(AwNotifySettings);
    await flushPromises();

    // Add an alert and save (enabled=true) — this should update this.config.
    wrapper.vm.alerts.push({ label: 'Work', category: 'Work', thresholdStr: '60', positive: true });
    await wrapper.vm.save();
    mockPost.mockClear();

    // Now disable and save again — the newly-added alert must survive.
    wrapper.vm.enabled = false;
    await wrapper.vm.save();

    expect(wrapper.vm.error).toBe('');
    const [, body] = mockPost.mock.calls[0];
    expect(body.enabled).toBe(false);
    expect(body.alerts).toHaveLength(1);
    expect(body.alerts[0].category).toBe('Work');
  });

  test('save() preserves unknown config keys (e.g. http_port)', async () => {
    mockGet.mockResolvedValue({ data: { enabled: false, alerts: [], http_port: 5600 } });
    const wrapper = shallowMount(AwNotifySettings);
    await flushPromises();

    await wrapper.vm.save();

    expect(mockPost).toHaveBeenCalledWith(
      expect.stringContaining('aw-notify'),
      expect.objectContaining({ http_port: 5600 }),
      expect.anything()
    );
  });
});
