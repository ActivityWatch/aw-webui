const queries = require('~/queries');

test('generate fullDesktopQuery', () => {
  const browserbuckets = [];
  const windowbucket = '';
  const afkbucket = '';
  const filterAFK = true;
  const classes = [];
  const filterCategories = true;
  const include_audible = true;
  const query_lines = queries.fullDesktopQuery(
    browserbuckets,
    windowbucket,
    afkbucket,
    filterAFK,
    classes,
    filterCategories,
    include_audible
  );

  // join query lines into a single string
  const query = query_lines.join('\n');

  // check that query_str is well formatted
  expect(query).toMatchSnapshot();
});
