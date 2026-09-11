jest.mock('aw-client', () => ({
  AWClient: jest.fn().mockImplementation(() => ({
    req: {
      interceptors: { response: { use: jest.fn() } },
      defaults: {
        headers: {
          common: {},
        },
      },
    },
  })),
}));

describe('awclient auth bootstrap', () => {
  let AWClient;
  let createClient, getApiTokenFromLocation, getStoredApiToken, loadApiTokenFromBrowser;

  beforeEach(async () => {
    jest.resetModules();
    ({ AWClient } = await import('aw-client'));
    ({ createClient, getApiTokenFromLocation, getStoredApiToken, loadApiTokenFromBrowser } =
      await import('~/util/awclient'));
    sessionStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  test('reads token from the URL query string', () => {
    expect(getApiTokenFromLocation({ search: '?token=secret&foo=bar' })).toBe('secret');
    expect(getApiTokenFromLocation({ search: '?token=   ' })).toBeNull();
    expect(getApiTokenFromLocation({ search: '?foo=bar' })).toBeNull();
  });

  test('loads token from URL, stores it for the tab, and strips it from the address bar', () => {
    window.history.replaceState({}, '', '/settings?token=secret&foo=bar#hash');

    expect(loadApiTokenFromBrowser()).toBe('secret');
    expect(getStoredApiToken()).toBe('secret');
    expect(window.location.pathname).toBe('/settings');
    expect(window.location.search).toBe('?foo=bar');
    expect(window.location.hash).toBe('#hash');
  });

  test('falls back to the stored token when the URL has none', () => {
    sessionStorage.setItem('aw-api-token', 'stored-secret');

    expect(loadApiTokenFromBrowser()).toBe('stored-secret');
  });

  test('createClient applies the Bearer token to default request headers', () => {
    window.history.replaceState({}, '', '/?token=secret');

    const client = createClient(true);

    expect(AWClient).toHaveBeenCalledWith(
      'aw-webui',
      expect.objectContaining({
        baseURL: 'http://127.0.0.1:5666',
        testing: true,
      })
    );
    expect(client.req.defaults.headers.common.Authorization).toBe('Bearer secret');
    expect(window.location.search).toBe('');
  });
  test('invalidates period caches after writes but not query POSTs', async () => {
    const { PeriodCache } = await import('~/util/periodCache');
    const client = createClient(true);
    const cache = new PeriodCache();
    const onResponse = client.req.interceptors.response.use.mock.calls[0][0];
    cache.set('period', 42);
    onResponse({ config: { method: 'post', url: '/0/query/' } });
    expect(cache.get('period')).toBe(42);
    for (const url of ['/0/buckets/window/events', '/0/import']) {
      cache.set('period', 42);
      onResponse({ config: { method: 'post', url } });
      expect(cache.get('period')).toBeUndefined();
    }
  });
});
