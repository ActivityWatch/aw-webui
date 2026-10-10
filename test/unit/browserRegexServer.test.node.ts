import { fullDesktopQuery } from '~/queries';

// CI runs this against both supported servers; local unit runs need no server.
const server = process.env.AW_QUERY_TEST_SERVER_URL;
const describeWithServer = server ? describe : describe.skip;

describeWithServer('browser regex matching through the server', () => {
  async function request(path: string, method: string, body?: unknown): Promise<any> {
    const response = await fetch(`${server}/api/0${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`${method} ${path}: ${response.status} ${text}`);
    }
    return text ? JSON.parse(text) : undefined;
  }

  test.each([
    ['arc', 'Arc.exe', 60],
    ['arc', 'arc.exe', 60],
    ['arc', 'ArcXexe', 0],
    ['chrome', 'Arc.exe', 60],
    ['chrome', 'arc.exe', 60],
    ['chrome', 'Dia.exe', 60],
    ['chrome', 'ArcXexe', 0],
    ['chrome', 'DiaXexe', 0],
  ])('%s bucket with %s retains %i seconds', async (browser, app, expected) => {
    const suffix = `regex-${process.pid}-${Date.now()}-${browser}-${app}`;
    const windowBucket = `aw-watcher-window_${suffix}`;
    const afkBucket = `aw-watcher-afk_${suffix}`;
    const browserBucket = `aw-watcher-web-${browser}_${suffix}`;
    const created: string[] = [];
    const timestamp = '2026-01-01T12:00:00Z';
    try {
      for (const [id, type, data] of [
        [windowBucket, 'currentwindow', { app, title: 'Browser test' }],
        [afkBucket, 'afkstatus', { status: 'not-afk' }],
        [browserBucket, 'web.tab.current', { url: 'https://example.com/', title: 'Browser test' }],
      ] as const) {
        await request(`/buckets/${id}`, 'POST', {
          client: 'aw-webui-regression-test',
          type,
          hostname: suffix,
        });
        created.push(id);
        await request(`/buckets/${id}/events`, 'POST', [{ timestamp, duration: 60, data }]);
      }
      const query = fullDesktopQuery({
        bid_window: windowBucket,
        bid_afk: afkBucket,
        bid_browsers: [browserBucket],
        filter_afk: true,
        include_audible: false,
        categories: [],
        filter_categories: [],
      });
      const result = await request('/query/', 'POST', {
        timeperiods: ['2026-01-01T12:00:00Z/2026-01-01T12:01:00Z'],
        query,
      });
      expect(result[0].browser.duration).toBe(expected);
    } finally {
      for (const id of created) {
        await request(`/buckets/${id}`, 'DELETE');
      }
    }
  });
});
