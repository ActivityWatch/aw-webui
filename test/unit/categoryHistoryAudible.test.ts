import { createPinia, setActivePinia } from 'pinia';
import moment from 'moment';
import { useActivityStore } from '~/stores/activity';
import { createClient } from '~/util/awclient';

// The category-by-period barchart must count audible browser time as active
// when include_audible is set, like the category totals (fullDesktopQuery);
// otherwise its bars add up to less than the totals shown beside them.
describe('query_category_time_by_period', () => {
  beforeEach(() => setActivePinia(createPinia()));

  async function categoryQueryFor(include_audible: boolean): Promise<string> {
    const client = createClient(true);
    const query = jest.spyOn(client, 'query').mockResolvedValue([{ cat_events: [] }]);
    const store = useActivityStore();
    store.buckets.window = ['aw-watcher-window_host'];
    store.buckets.afk = ['aw-watcher-afk_host'];
    store.buckets.browser = ['aw-watcher-web-firefox_host'];
    const opts = {
      host: 'host',
      timeperiod: { start: moment('2020-01-06').format(), length: [1, 'day'] as [number, string] },
      filter_afk: true,
      include_audible,
    };
    store.query_options = opts;
    await store.query_category_time_by_period(opts);
    expect(query).toHaveBeenCalled();
    return (query.mock.calls[0][1] as string[]).join('\n');
  }

  test('honours include_audible', async () => {
    expect(await categoryQueryFor(true)).toContain('audible_events');
  });

  test('leaves audible time out when include_audible is off', async () => {
    expect(await categoryQueryFor(false)).not.toContain('audible_events');
  });
});
