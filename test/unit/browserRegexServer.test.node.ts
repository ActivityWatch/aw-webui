import { canonicalEvents, fullDesktopQuery } from '~/queries';
import {
  MERGE_SUBWATCHER_FIELDS_PROBE_QUERY,
  setSupportsMergeSubwatcherFields,
  supportsMergeSubwatcherFields,
} from '~/util/serverCapabilities';

// CI runs this against both supported servers; local unit runs need no server.
const server = process.env.AW_QUERY_TEST_SERVER_URL;
const describeWithServer = server ? describe : describe.skip;

describeWithServer('browser regex matching through the server', () => {
  // Tracks unexpected probe failures so enrichment tests fail loudly instead of
  // silently skipping (e.g. a transient HTTP 500 looks like "unsupported" without this).
  let probeError: Error | null = null;

  // Older servers (the supported floor) lack merge_subwatcher_fields; enabling
  // the capability only when the server resolves it keeps this suite green
  // there while still exercising URL enrichment against newer servers.
  beforeAll(async () => {
    try {
      const response = await fetch(`${server}/api/0/query/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeperiods: ['2000-01-01T00:00:00Z/2000-01-01T00:00:01Z'],
          query: [MERGE_SUBWATCHER_FIELDS_PROBE_QUERY],
        }),
      });
      if (response.ok) {
        setSupportsMergeSubwatcherFields(true);
      } else {
        // An unsupported server rejects the unknown function: aw-server-rust with
        // VariableNotDefined, aw-server (Python) with QueryInterpretException
        // "Tried to call function '…' which doesn't exist". Any other non-OK
        // response (5xx, auth error, …) is unexpected — record it so enrichment
        // tests fail rather than silently skip.
        const body = await response.text();
        const unsupported =
          body.includes('VariableNotDefined') ||
          (body.includes('QueryInterpretException') &&
            body.includes("'merge_subwatcher_fields' which doesn't exist"));
        if (unsupported) {
          setSupportsMergeSubwatcherFields(false);
        } else {
          probeError = new Error(`Unexpected probe response ${response.status}: ${body}`);
          setSupportsMergeSubwatcherFields(false);
        }
      }
    } catch (e) {
      probeError = e instanceof Error ? e : new Error(String(e));
      setSupportsMergeSubwatcherFields(false);
    }
  });

  afterAll(() => setSupportsMergeSubwatcherFields(false));

  test.each([
    ['https://native.example/page', 'https://native.example/page', 'native.example'],
    [undefined, 'https://browser.example/page', 'browser.example'],
    ['not a valid URL', 'not a valid URL', undefined],
  ])('derives the domain from the chosen window URL %s', async (nativeUrl, url, domain) => {
    // This regression needs the new backend function, unlike the compatibility
    // cases below that also run against the supported server floor.
    if (probeError) throw probeError;
    if (!supportsMergeSubwatcherFields()) return;
    const suffix = `url-domain-${process.pid}-${Date.now()}`;
    const windowBucket = `aw-watcher-window_${suffix}`;
    const browserBucket = `aw-watcher-web-chrome_${suffix}`;
    const created: string[] = [];
    const windowData: Record<string, string> = { app: 'Google Chrome', title: 'Native page' };
    if (nativeUrl !== undefined) windowData.url = nativeUrl;
    try {
      for (const [id, type, data] of [
        [windowBucket, 'currentwindow', windowData],
        [browserBucket, 'web.tab.current', { url: 'https://browser.example/page' }],
      ] as const) {
        await request(`/buckets/${id}`, 'POST', {
          client: 'aw-webui-regression-test',
          type,
          hostname: suffix,
        });
        created.push(id);
        await request(`/buckets/${id}/events`, 'POST', [
          {
            timestamp: '2026-01-01T12:00:00Z',
            duration: 60,
            data,
          },
        ]);
      }
      const query = canonicalEvents({
        bid_window: windowBucket,
        bid_afk: '',
        bid_browsers: [browserBucket],
        filter_afk: false,
        include_audible: false,
        categories: [],
        filter_categories: [],
      });
      const result = await request('/query/', 'POST', {
        timeperiods: ['2026-01-01T12:00:00Z/2026-01-01T12:01:00Z'],
        query: [query, 'RETURN = events;'],
      });
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].duration).toBe(60);
      expect(result[0][0].data.url).toBe(url);
      if (domain === undefined) {
        // Python's parser emits an empty domain for malformed URLs; Rust
        // leaves it absent. Neither may retain the other page's domain.
        expect(result[0][0].data.$domain).toBeFalsy();
      } else {
        expect(result[0][0].data.$domain).toBe(domain);
      }
    } finally {
      for (const id of created) await request(`/buckets/${id}`, 'DELETE');
    }
  });

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
