import { parseCategoryImport, shouldAttemptJsonImport } from '~/util/importFile';

describe('shouldAttemptJsonImport', () => {
  test('accepts application/json regardless of filename', () => {
    expect(shouldAttemptJsonImport({ name: 'rules', type: 'application/json' })).toBe(true);
  });

  test('accepts .json files Android reports as octet-stream', () => {
    expect(
      shouldAttemptJsonImport({
        name: 'aw-category-export-default.json',
        type: 'application/octet-stream',
      })
    ).toBe(true);
  });

  test('accepts .json files with empty MIME (WebView/SAF)', () => {
    expect(shouldAttemptJsonImport({ name: 'cats.json', type: '' })).toBe(true);
  });

  test('accepts .json files reported as text/plain', () => {
    expect(shouldAttemptJsonImport({ name: 'cats.json', type: 'text/plain' })).toBe(true);
  });

  test('rejects camera/gallery image picks', () => {
    expect(shouldAttemptJsonImport({ name: 'IMG_001.jpg', type: 'image/jpeg' })).toBe(false);
  });

  test('attempts octet-stream without a .json name (JSON.parse decides)', () => {
    expect(shouldAttemptJsonImport({ name: 'document', type: 'application/octet-stream' })).toBe(
      true
    );
  });
});

describe('parseCategoryImport', () => {
  test('parses named category-set export', () => {
    const parsed = parseCategoryImport(
      JSON.stringify({ id: 'default', categories: [{ name: ['Work'], rule: { type: 'none' } }] })
    );
    expect(parsed.id).toBe('default');
    expect(parsed.categories).toHaveLength(1);
  });

  test('parses legacy flat {categories} export', () => {
    const parsed = parseCategoryImport(
      JSON.stringify({ categories: [{ name: ['Work'], rule: { type: 'none' } }] })
    );
    expect(parsed.id).toBeUndefined();
    expect(parsed.categories).toHaveLength(1);
  });

  test('rejects JSON that is not a category export', () => {
    expect(() => parseCategoryImport('{"foo": 1}')).toThrow(/Unrecognized import format/);
  });

  test('rejects invalid JSON', () => {
    expect(() => parseCategoryImport('{')).toThrow();
  });

  test.each([
    null,
    7,
    [],
    {},
    { name: 7, rule: { type: 'none' } },
    { name: [], rule: { type: 'none' } },
    { name: [''], rule: { type: 'none' } },
    { name: ['Work', null], rule: { type: 'none' } },
    { name: ['Work'] },
    { name: ['Work'], rule: null },
    { name: ['Work'], rule: [] },
    { name: ['Work'], rule: {} },
    { name: ['Work'], rule: { type: 'glob' } },
    { name: ['Work'], rule: { type: 'regex' } },
    { name: ['Work'], rule: { type: 'regex', regex: 7 } },
    { name: ['Work'], rule: { type: 'regex', regex: 'x', ignore_case: 'false' } },
    { name: ['Work'], rule: { type: 'regex', regex: 'x', priority: '1' } },
    { name: ['Work'], rule: { type: 'regex', regex: 'x', weight: {} } },
    { name: ['Work'], rule: { type: 'regex', regex: 'x', select_keys: 'app' } },
    { name: ['Work'], rule: { type: 'regex', regex: 'x', select_keys: ['app', 7] } },
    { name: ['Work'], rule: { type: 'none' }, data: [] },
    { name: ['Work'], rule: { type: 'none' }, data: { color: 7 } },
    { name: ['Work'], rule: { type: 'none' }, data: { score: '10' } },
  ])('rejects the entire mixed array with malformed member %j', invalid => {
    const categories = [{ name: ['Valid'], rule: { type: 'none' } }, invalid];
    expect(() => parseCategoryImport(JSON.stringify({ id: 'mine', categories }))).toThrow();
    expect(() => parseCategoryImport(JSON.stringify({ categories }))).toThrow();
  });

  test.each([
    { name: ['Literal > segment', 'constructor'], rule: { type: 'none' } },
    { name: ['Old parent'], rule: { type: null } },
    { name: ['Editable pattern'], rule: { type: 'regex', regex: '[' } },
    { name: ['Blank pattern'], rule: { type: 'regex', regex: '' } },
    {
      name: ['Metadata'],
      rule: {
        type: 'regex',
        regex: 'vim',
        ignore_case: false,
        priority: 0,
        weight: 1,
        select_keys: ['app', '$custom', 'app'],
      },
      data: { color: '#123456', score: 0, custom: { retained: true } },
    },
    { name: ['Inheritance'], rule: { type: 'none' }, data: { color: null, score: null } },
  ])('preserves compatible category values %j', category => {
    const payload = { id: 'mine', categories: [category] };
    expect(parseCategoryImport(JSON.stringify(payload))).toEqual(payload);
  });

  test('accepts empty named and legacy arrays', () => {
    expect(parseCategoryImport('{"id":"empty","categories":[]}')).toEqual({
      id: 'empty',
      categories: [],
    });
    expect(parseCategoryImport('{"categories":[]}').categories).toEqual([]);
  });
});
