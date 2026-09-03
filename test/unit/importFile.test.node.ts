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
});
