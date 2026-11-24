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

// ActivityWatch/aw-webui#1328 item 4: Color() throws on these, which stopped the
// summary and Timeline mid-render.
test.each(['#ab', '#12345', 'bluee', 'red; position: fixed'])(
  'an invalid category color %p falls back to the parent color',
  invalid => {
    const classes = [
      { name: ['Work'], rule: { type: 'none' }, data: { color: '#F00' } },
      { name: ['Work', 'Bad'], rule: { type: 'none' }, data: { color: invalid } },
    ];
    expect(color.isValidColor(invalid)).toBe(false);
    expect(color.getColorFromCategory(classes[1], classes)).toEqual('#F00');
  }
);

test('valid color formats are kept', () => {
  for (const valid of ['#abc', '#AABBCC', 'red', 'hsl(10, 50%, 50%)']) {
    expect(color.isValidColor(valid)).toBe(true);
  }
});
