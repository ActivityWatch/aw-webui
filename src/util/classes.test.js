const classes = require('./classes');

let testClasses = [
  { name: 'Test -> Subtest', rule: { type: 'regex', pattern: 'test' } },
  { name: 'Test -> Subtest -> Subsubtest', rule: { type: 'regex', pattern: 'test' } },
];

test('correctly builds hierarchy', () => {
  let result = classes.build_category_hierarchy(testClasses);
  expect(result).toHaveLength(1);
  let cat_root = result[0];
  expect(cat_root.subname).toEqual('Test');
  expect(cat_root.children).toHaveLength(1);
  expect(result[0].children[0].children).toHaveLength(1);
});

test('correctly flatten hierarchy', () => {
  let result = classes.flatten_category_hierarchy(classes.build_category_hierarchy(testClasses));
  expect(result).toHaveLength(3);
});
