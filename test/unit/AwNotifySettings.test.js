import AwNotifySettings from '~/views/settings/AwNotifySettings.vue';
import { getClient } from '~/util/awclient';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

describe('AwNotifySettings load', () => {
  let vm;
  let get;
  let post;

  beforeEach(() => {
    vm = { ...AwNotifySettings.data(), ...AwNotifySettings.methods };
    get = jest.fn();
    post = jest.fn().mockResolvedValue({});
    getClient.mockReturnValue({ req: { get, post } });
  });

  test.each([null, undefined])('loads defaults for an absent setting (%s)', async data => {
    get.mockResolvedValue({ data });

    await vm.load();

    expect(get).toHaveBeenCalledWith('/0/settings/aw-notify');
    expect(vm.alerts).toEqual(vm.defaultAlerts());
    expect(vm.config).toEqual({});
    expect(vm.error).toBe('');
    expect(vm.loading).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  test('loads defaults for HTTP 404', async () => {
    get.mockRejectedValue({ response: { status: 404 } });

    await vm.load();

    expect(vm.alerts).toEqual(vm.defaultAlerts());
    expect(vm.config).toEqual({});
    expect(vm.error).toBe('');
    expect(vm.loading).toBe(false);
  });

  test('loads saved alerts and preserves optional settings when saving', async () => {
    const config = {
      alerts: [{ category: 'Work', label: null, thresholds_minutes: [30, 90], positive: true }],
      hourly_checkins: true,
      http_port: 5667,
    };
    get.mockResolvedValue({ data: config });

    await vm.load();

    expect(vm.alerts).toEqual([
      { category: 'Work', label: '', thresholdStr: '30, 90', positive: true },
    ]);
    expect(vm.config).toEqual(config);
    expect(vm.error).toBe('');
    expect(vm.loading).toBe(false);

    await vm.save();

    expect(post).toHaveBeenCalledWith('/0/settings/aw-notify', config, {
      headers: { 'Content-Type': 'application/json' },
    });
  });

  test('keeps an intentionally empty alert list', async () => {
    get.mockResolvedValue({ data: { alerts: [] } });

    await vm.load();

    expect(vm.alerts).toEqual([]);
    expect(vm.error).toBe('');
  });

  test.each([false, 0, '', {}, { alerts: [{}] }])(
    'reports malformed non-null settings (%j)',
    async data => {
      get.mockResolvedValue({ data });

      await vm.load();

      expect(vm.error).toBe(
        'Failed to load settings: The saved aw-notify setting has an unsupported format.'
      );
      expect(vm.alerts).toEqual([]);
      expect(vm.loading).toBe(false);
      expect(post).not.toHaveBeenCalled();
    }
  );

  test('reports other request failures', async () => {
    get.mockRejectedValue(new Error('Network error'));

    await vm.load();

    expect(vm.error).toBe('Failed to load settings: Network error');
    expect(vm.loading).toBe(false);
  });
});
