const color = require('~/util/color');

const testClasses = [
  {
    name: ['Test', 'Subtest'],
    rule: { type: 'regex', pattern: 'subtest' },
    data: { color: '#F00' },
  },
  {
    name: ['Test', 'Subtest', 'Subsubtest'],
    rule: { type: 'regex', pattern: 'subsubtest' },
  },
];

test('returns parent category color as fallback', () => {
  const _color = color.getColorFromCategory(testClasses[1], testClasses);
  expect(_color).toEqual('#F00');
});
