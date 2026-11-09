import { i18n } from '~/i18n';
import { categoryPathLabel, categorySegmentLabel } from '~/util/categoryLabels';
import { defaultCategories } from '~/util/classes';

describe('category display labels', () => {
  afterEach(() => {
    i18n.locale = 'en';
  });

  test('English labels equal the stored default names', () => {
    i18n.locale = 'en';
    for (const cat of defaultCategories) {
      expect(categoryPathLabel(cat.name)).toBe(cat.name.join(' > '));
    }
  });

  test('default segments follow the active locale', () => {
    i18n.locale = 'de';
    expect(categoryPathLabel(['Work', 'Programming'])).toBe('Arbeit > Programmierung');
    expect(categorySegmentLabel('Uncategorized')).toBe(String(i18n.t('common.uncategorized')));
    i18n.locale = 'sv';
    expect(categoryPathLabel(['Media', 'Social Media'])).toBe('Media > Sociala medier');
  });

  test('custom names and proper nouns pass through unchanged', () => {
    i18n.locale = 'de';
    expect(categoryPathLabel(['Work', 'MyProject'])).toBe('Arbeit > MyProject');
    expect(categoryPathLabel(['Work', 'Programming', 'ActivityWatch'])).toBe(
      'Arbeit > Programmierung > ActivityWatch'
    );
    expect(categorySegmentLabel('constructor')).toBe('constructor');
    expect(categorySegmentLabel('work')).toBe('work');
  });

  test('custom separator and missing paths', () => {
    i18n.locale = 'de';
    expect(categoryPathLabel(['Comms', 'Email'], '>')).toBe('Kommunikation>E-Mail');
    expect(categoryPathLabel(undefined)).toBe('');
    expect(categoryPathLabel([])).toBe('');
  });

  test('every default segment except proper nouns has a translation key', () => {
    const untranslated = new Set(['ActivityWatch', '3D']);
    i18n.locale = 'ja';
    for (const cat of defaultCategories) {
      for (const segment of cat.name) {
        if (untranslated.has(segment)) continue;
        expect(categorySegmentLabel(segment)).not.toBe(segment);
      }
    }
  });
});
