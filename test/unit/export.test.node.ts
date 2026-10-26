/**
 * @jest-environment node
 */

import Papa from 'papaparse';

import {
  androidExportFromUrl,
  CSV_FORMULA_PATTERN,
  neutralizeCsvFormula,
} from '../../src/util/export';

describe('androidExportFromUrl', () => {
  afterEach(() => {
    delete (global as any).window;
  });

  test('returns false when the Android bridge is absent', () => {
    // @ts-expect-error jsdom-less node
    global.window = {};
    expect(androidExportFromUrl('/api/0/export', 'aw-bucket-export.json')).toBe(false);
  });

  test('calls the native bridge and returns true', () => {
    const exportFromUrl = jest.fn();
    // @ts-expect-error test double
    global.window = { Android: { exportFromUrl } };
    expect(androidExportFromUrl('/api/0/export', 'aw-bucket-export.json')).toBe(true);
    expect(exportFromUrl).toHaveBeenCalledWith('/api/0/export', 'aw-bucket-export.json');
  });
});

describe('CSV formula neutralization', () => {
  test.each([
    '=HYPERLINK("http://example.invalid","x")',
    '+1+1',
    '-1+1',
    '@SUM(A1)',
    ' =1+1',
    '\t=1+1',
    '\r\n@SUM(A1)',
  ])('prefixes formula-like cell %j', value => {
    expect(neutralizeCsvFormula(value)).toBe(`'${value}`);
  });

  test.each(['GitHub - Mozilla Firefox', 'a=b', '', '1+1', 'email@example.com'])(
    'leaves plain cell %j unchanged',
    value => {
      expect(neutralizeCsvFormula(value)).toBe(value);
    }
  );

  test('Papa.unparse with the pattern escapes string cells only', () => {
    const csv = Papa.unparse([['2026-10-26T08:00:00Z', -5, 'Firefox', ' =1+1']], {
      columns: ['timestamp', 'duration', 'app', 'title'],
      escapeFormulae: CSV_FORMULA_PATTERN,
    });
    expect(csv).toBe('2026-10-26T08:00:00Z,-5,Firefox,"\' =1+1"');
  });
});
