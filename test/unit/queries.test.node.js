const queries = require('~/queries');

// test data
const hostname = 'testhost';
const bid_window = 'aw-watcher-window_' + hostname;
const bid_afk = 'aw-watcher-afk_' + hostname;
const bid_browsers = [];
const filter_afk = true;
const always_active_pattern = /meow|nyaan|specials: \w(\\)/.toString().substring(1).slice(0, -1);
const queryParams = {
  bid_window,
  bid_afk,
  bid_browsers,
  filter_afk,
  categories: [],
  filter_categories: true,
  include_audible: true,
  always_active_pattern,
};

function expectBracketsClosed(query) {
  // Checks that there are matching parens, brackets, braces, etc
  // Doesn't actually check placement, just matching open/closed count.

  // parens
  const openParens = query.match(/\(/g);
  const closeParens = query.match(/\)/g);
  expect(openParens && openParens.length).toEqual(closeParens && closeParens.length);

  // brackets
  const openBrackets = query.match(/\[/g);
  const closeBrackets = query.match(/\]/g);
  expect(openBrackets && openBrackets.length).toEqual(closeBrackets && closeBrackets.length);

  // braces
  const openBraces = query.match(/\{/g);
  const closeBraces = query.match(/\}/g);
  expect(openBraces && openBraces.length).toEqual(closeBraces && closeBraces.length);
}

test('browserSearchQuery with no buckets returns empty array', () => {
  const result = queries.browserSearchQuery([], 'github\\.com');
  expect(result).toEqual([]);
});

test('browserSearchQuery with browser bucket generates valid query', () => {
  const buckets = ['aw-watcher-web-firefox_testhost'];
  const query = queries.browserSearchQuery(buckets, 'github\\.com').join('\n');
  expect(query).toMatchSnapshot();
  expectBracketsClosed(query);
  // Must query the bucket, split urls, filter on both url and title
  expect(query).toContain('query_bucket("aw-watcher-web-firefox_testhost")');
  expect(query).toContain('split_url_events');
  expect(query).toContain('"url"');
  expect(query).toContain('"title"');
  expect(query).toContain('RETURN = browser_results');
});

test('generate fullDesktopQuery', () => {
  let query = queries.fullDesktopQuery(queryParams).join('\n');
  expect(query).toMatchSnapshot();
  expectBracketsClosed(query);

  query = queries.activityQuery([bid_afk]).join('\n');
  expect(query).toMatchSnapshot();
  expectBracketsClosed(query);
});
