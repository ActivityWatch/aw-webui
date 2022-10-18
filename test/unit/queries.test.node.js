const queries = require('~/queries');

test('generate fullDesktopQuery', () => {
  const bid_window = '';
  const bid_afk = '';
  const bid_browsers = [];
  const filter_afk = true;
  const categories = [];
  const filter_categories = true;
  const include_audible = true;
  const always_active_pattern = /meow|nyaan|specials: \w(\\)/.toString().substring(1).slice(0, -1);
  const query_lines = queries.fullDesktopQuery({
    bid_window,
    bid_afk,
    bid_browsers,
    filter_afk,
    categories,
    filter_categories,
    include_audible,
    always_active_pattern,
  });

  // join query lines into a single string
  const query = query_lines.join('\n');

  // check that query_str is well formatted
  expect(query).toMatchSnapshot();
});
