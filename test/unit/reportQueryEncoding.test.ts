import { categoriesForQuery } from '~/queries';
import { buildWorkReportQuery } from '~/util/workReport';
import { getClient } from '~/util/awclient';
import BillingViewComponent from '~/views/BillingView.vue';

jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));

const BillingView: any = BillingViewComponent;
const hosts = [{ host: 'laptop', window: 'window_laptop', afk: 'afk_laptop' }];

async function billingQuery(categories: any[], windowId = 'window_laptop', afkId = 'afk_laptop') {
  const query = jest.fn().mockResolvedValue([{ events: [], duration: 0 }]);
  (getClient as jest.Mock).mockReturnValue({ query });
  const ctx = {
    selectedHosts: ['laptop'],
    bucketsStore: {
      buckets: [
        { id: windowId, hostname: 'laptop', type: 'currentwindow' },
        { id: afkId, hostname: 'laptop', type: 'afkstatus' },
      ],
    },
    categoryStore: { classes_for_query: categories },
    getTimeperiod: () => '2026-11-01/2026-12-01',
    $t: (key: string) => key,
    errorMessage: '',
  };
  await BillingView.methods.loadData.call(ctx);
  expect(ctx.errorMessage).toBe('');
  expect(query).toHaveBeenCalledTimes(1);
  return query.mock.calls[0][1][0] as string;
}

test.each([' \n', '\t\n', ' \r\n'])('reports preserve category whitespace %j', async whitespace => {
  const names = [`Work${whitespace}Project`, 'Work\nProject'];
  const categories: any[] = names.map(name => [[name], { type: 'regex', regex: 'Code' }]);
  const encoded = categoriesForQuery(categories);
  const work = buildWorkReportQuery(hosts, encoded, [[names[0]]]);
  const billing = await billingQuery(categories);
  for (const query of [work, billing]) {
    // These are actual aw-query literal contents, not JSON escape sequences.
    expect(query).toContain(`categorize(events_0, ${encoded})`);
    expect(query).toContain(`"${names[0]}"`);
    expect(query).toContain(`"${names[1]}"`);
  }
  expect(work).toContain(`filter_keyvals(events_0, "$category", [["${names[0]}"]])`);
});

test('billing bucket IDs preserve backslashes as well as quotes', async () => {
  const query = await billingQuery([], 'window_Dev\\Ops "box"', 'afk_Dev\\Ops "box"');
  expect(query).toContain('query_bucket("window_Dev\\Ops \\"box\\"")');
  expect(query).toContain('query_bucket("afk_Dev\\Ops \\"box\\"")');
});
