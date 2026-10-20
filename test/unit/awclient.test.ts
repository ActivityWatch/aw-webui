jest.mock('aw-client', () => ({
  AWClient: jest.fn().mockImplementation(() => ({
    req: {
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
});
