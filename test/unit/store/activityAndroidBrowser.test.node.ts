import { createPinia, setActivePinia } from 'pinia';

import { useActivityStore } from '~/stores/activity';
import { createClient, getClient } from '~/util/awclient';

createClient();

const event = (domain: string, duration: number) => ({
  timestamp: '2024-01-01T00:00:00Z',
  duration,
  data: { $domain: domain, url: `https://${domain}`, title: domain },
});

describe('Android browser completion', () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => jest.restoreAllMocks());

  test('keeps browser-only querying for ScreenTime imports', async () => {
    const store = useActivityStore();
    store.buckets.android = ['aw-import-screentime_device'];
    store.buckets.browser = ['aw-watcher-web-chrome'];
    store.browser.available = true;
    const queryBrowserOnly = jest.spyOn(store, 'query_browser_only').mockResolvedValue();
    const query = jest
      .spyOn(getClient(), 'query')
      .mockResolvedValue([
        { app_events: [], app_cat_events: [], title_events: [], cat_events: [] },
      ]);
    const options = {
      timeperiod: { start: '2024-01-01T00:00:00Z', length: [1, 'day'] },
      filter_categories: [],
    } as any;

    await store.query_android(options);

    expect(queryBrowserOnly).toHaveBeenCalledWith({ timeperiod: options.timeperiod });
    expect(query).toHaveBeenCalledTimes(1);
  });

  test('completes browser state when the app query returns no result', async () => {
    const store = useActivityStore();
    store.buckets.android = ['aw-watcher-android_device'];
    store.buckets.browser = ['aw-watcher-web-chrome'];
    store.browser.available = true;
    store.browser.top_domains = null;
    store.browser.top_urls = null;
    store.browser.top_titles = null;
    jest.spyOn(getClient(), 'query').mockResolvedValue([]);

    await store.query_android({
      timeperiod: { start: '2024-01-01T00:00:00Z', length: [1, 'day'] },
      filter_categories: [],
    } as any);

    expect(store.browser.top_domains).toEqual([]);
    expect(store.browser.top_urls).toEqual([]);
    expect(store.browser.top_titles).toEqual([]);
  });

  test('completes empty browser state when a browser chunk fails', async () => {
    const store = useActivityStore();
    store.buckets.android = ['aw-watcher-android_device'];
    store.buckets.browser = ['aw-watcher-web-chrome'];
    store.browser.available = true;
    store.browser.top_domains = null;
    store.browser.top_urls = null;
    store.browser.top_titles = null;
    store.browser.duration = 123;
    jest
      .spyOn(getClient(), 'query')
      .mockResolvedValueOnce([
        { app_events: [], app_cat_events: [], title_events: [], cat_events: [] },
      ])
      .mockResolvedValueOnce([]);

    await store.query_android({
      timeperiod: { start: '2024-01-01T00:00:00Z', length: [1, 'day'] },
      filter_categories: [],
    } as any);

    expect(store.browser.top_domains).toEqual([]);
    expect(store.browser.top_urls).toEqual([]);
    expect(store.browser.top_titles).toEqual([]);
    expect(store.browser.duration).toBe(0);
  });

  test('ranks a shared domain above chunk-local leaders after merging', async () => {
    const store = useActivityStore();
    store.buckets.android = ['aw-watcher-android_device'];
    store.buckets.browser = ['aw-watcher-web-chrome'];
    store.browser.available = true;
    const chunks = [0, 1].map(chunk => [
      ...Array.from({ length: 100 }, (_, i) => event(`chunk${chunk}-${i}.example`, 11)),
      event('shared.example', 10),
    ]);
    let browserChunk = 0;
    jest.spyOn(getClient(), 'query').mockImplementation(async (_periods, query) => {
      const code = query.join('\n');
      if (!code.includes('browser_domains =')) {
        return [{ app_events: [], app_cat_events: [], title_events: [], cat_events: [] }];
      }
      // Model the server's limit_events operation so the old query actually
      // loses the shared domain, rather than returning an unrealistically full result.
      const limit = code.match(/limit_events\(browser_domains, (\d+)\)/);
      const events = chunks[browserChunk++];
      const retained = limit ? events.slice(0, Number(limit[1])) : events;
      return [{ browser: { domains: retained, urls: retained, titles: retained, duration: 1110 } }];
    });

    await store.query_android({
      timeperiod: { start: '2024-01-01T00:00:00Z', length: [184, 'days'] },
      filter_categories: [],
    } as any);

    expect(browserChunk).toBe(2);
    expect(store.browser.top_domains).toHaveLength(100);
    expect(store.browser.top_domains?.[0].data.$domain).toBe('shared.example');
    expect(store.browser.top_domains?.[0].duration).toBe(20);
    expect(store.browser.top_urls?.[0].data.url).toBe('https://shared.example');
    expect(store.browser.top_titles?.[0].data.title).toBe('shared.example');
  });
});
