import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import { useActivityStore } from '~/stores/activity';
import type { QueryOptions } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { createClient } from '~/util/awclient';
import type { IBucket } from '~/util/interfaces';
import { fullDesktopQuery, multideviceQuery, default_limit } from '~/queries';

function limitFrom(query: string[], variable: string): number {
  const m = query.join('\n').match(new RegExp(`limit_events\\(${variable}, (\\d+)\\)`));
  return m ? parseInt(m[1], 10) : Infinity;
}

describe('chunked desktop queries keep long-tail entries', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  // A week is queried as 7 daily chunks and merged client-side. With each chunk
  // cut to the top 100 titles server-side, a title that ranks 101st on every
  // day lost all of its time, even though it is the week's top title.
  test.each(['desktop', 'multidevice'])(
    '%s week view over-fetches with a cap and re-limits after merging',
    async mode => {
      const client = createClient(true);
      let call = 0;
      jest.spyOn(client, 'query').mockImplementation(async (_periods: any, query: any) => {
        const day = call++;
        expect(limitFrom(query, 'title_events')).toBe(1000);
        expect(limitFrom(query, 'app_events')).toBe(1000);
        // Simulated server: 100 day-unique titles at 10s, plus "Common" at 9s every day
        let titles = Array.from({ length: 100 }, (_v, i) => ({
          timestamp: '2020-01-06T00:00:00Z',
          duration: 10,
          data: { app: 'app', title: `day${day}-title${i}` },
        }));
        titles.push({
          timestamp: '2020-01-06T00:00:00Z',
          duration: 9,
          data: { app: 'app', title: 'Common' },
        });
        titles = titles.slice(0, limitFrom(query, 'title_events'));
        return [
          {
            window: {
              app_events: [
                { timestamp: '2020-01-06T00:00:00Z', duration: 1009, data: { app: 'app' } },
              ],
              title_events: titles,
              cat_events: [],
              active_events: [],
              duration: 1009,
              raw_duration: 1009,
            },
            browser: {},
          },
        ];
      });
      const store = useActivityStore();
      store.buckets.window = ['aw-watcher-window_host'];
      store.buckets.afk = ['aw-watcher-afk_host'];
      const options: QueryOptions = {
        host: 'host',
        timeperiod: { start: moment('2020-01-06').format(), length: [1, 'week'] },
        filter_afk: true,
      };
      if (mode === 'multidevice') {
        useBucketsStore().buckets = ['host', 'laptop'].flatMap(
          hostname =>
            [
              ['aw-watcher-window', 'currentwindow'],
              ['aw-watcher-afk', 'afkstatus'],
            ].map(([prefix, type]) => ({
              id: `${prefix}_${hostname}`,
              type,
              hostname,
              device_id: hostname,
              data: {},
            })) as IBucket[]
        );
        await store.query_multidevice_full(options, ['host', 'laptop']);
      } else {
        await store.query_desktop_full(options);
      }
      expect(call).toBe(7);
      const common = (store.window.top_titles || []).find(e => e.data.title === 'Common');
      // True weekly total: 7 * 9 = 63s, the biggest title of the week
      expect(common && common.duration).toBe(63);
      expect(store.window.top_titles[0].data.title).toBe('Common');
      expect(store.window.top_titles).toHaveLength(default_limit);
    }
  );

  test('single-period queries keep the default limit', () => {
    expect(
      limitFrom(
        fullDesktopQuery({ bid_window: 'w', bid_afk: 'a', bid_browsers: [] } as any),
        'title_events'
      )
    ).toBe(default_limit);
    expect(limitFrom(multideviceQuery({ hosts: [] } as any), 'title_events')).toBe(default_limit);
  });
});
