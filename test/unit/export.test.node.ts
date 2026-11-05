/**
 * @jest-environment node
 */

import { execFileSync } from 'child_process';
import path from 'path';

import Papa from 'papaparse';

import {
  androidExportFromUrl,
  CSV_FORMULA_PATTERN,
  exportRangeQuery,
  exportRangeSuffix,
  neutralizeCsvFormula,
  reportEventsCsv,
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

describe('reportEventsCsv', () => {
  test.each(['=1+1', '+1+1', '-1+1', '@SUM(A1)', ' =1+1', '\t=1+1', '\r\n@SUM(A1)'])(
    'neutralizes array-valued category paths starting with %j',
    category => {
      const csv = reportEventsCsv([
        {
          timestamp: '2026-10-26T08:00:00Z',
          duration: -5,
          data: { $category: [category, 'Child'], app: 'Firefox', title: 'Example' },
        },
      ]);
      const rows = Papa.parse<string[]>(csv).data;
      expect(rows[1]).toEqual([
        '2026-10-26T08:00:00Z',
        '-5',
        `'${category},Child`,
        'Firefox',
        'Example',
      ]);
    }
  );

  test.each([
    { category: ['Work', 'Programming'], expected: 'Work,Programming' },
    { category: [], expected: '' },
    { category: undefined, expected: '' },
    { category: null, expected: '' },
    { category: '=1+1', expected: "'=1+1" },
  ])('preserves CSV representation of $category', ({ category, expected }) => {
    const csv = reportEventsCsv([
      {
        timestamp: '2026-10-26T08:00:00Z',
        duration: 60,
        data: { $category: category, app: 'Firefox', title: 'Example' },
      },
    ]);
    expect(Papa.parse<string[]>(csv).data[1][2]).toBe(expected);
  });

  test('writes a header row and neutralizes formula-like titles', () => {
    const csv = reportEventsCsv([
      {
        timestamp: '2026-10-26T08:00:00Z',
        duration: 60,
        data: { $category: ['Work'], app: 'Firefox', title: '=1+1' },
      },
    ]);
    expect(csv.split(/\r?\n/)).toEqual([
      'timestamp,duration,category,app,title',
      '2026-10-26T08:00:00Z,60,Work,Firefox,"\'=1+1"',
    ]);
  });
});

describe('exportRangeQuery', () => {
  const params = (query: string) => Object.fromEntries(new URLSearchParams(query.slice(1)));

  test('no days: no query, the whole history', () => {
    expect(exportRangeQuery('', '')).toBe('');
  });

  test('one side only leaves the other open', () => {
    expect(Object.keys(params(exportRangeQuery('2026-11-04', '')))).toEqual(['start']);
    expect(Object.keys(params(exportRangeQuery('', '2026-11-04')))).toEqual(['end']);
  });

  // Node reads TZ at startup; replay in a child so default UTC CI checks local days too.
  if (process.env.TZ !== 'Europe/Brussels') {
    test('replays local-day cases in Europe/Brussels', () => {
      expect(() =>
        execFileSync(
          process.execPath,
          [
            require.resolve('jest/bin/jest'),
            '--selectProjects',
            'node',
            '--runInBand',
            '--coverage=false',
            '--runTestsByPath',
            __filename,
            '--testNamePattern=in Europe/Brussels',
          ],
          {
            cwd: path.resolve(__dirname, '../..'),
            env: { ...process.env, TZ: 'Europe/Brussels' },
            stdio: 'pipe',
            timeout: 60000,
          }
        )
      ).not.toThrow();
    }, 65000);
  }

  const describeBrussels = process.env.TZ === 'Europe/Brussels' ? describe : describe.skip;
  describeBrussels('in Europe/Brussels', () => {
    test('whole local days, from the start of the first to the end of the last', () => {
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe('Europe/Brussels');
      // Brussels is UTC+1 in winter: local midnight is 23:00 UTC the day before.
      expect(params(exportRangeQuery('2026-10-26', '2026-10-30'))).toEqual({
        start: '2026-10-25T23:00:00.000Z',
        end: '2026-10-30T23:00:00.000Z',
      });
    });

    test('a day across the DST change lasts 25 hours', () => {
      // Summer time ends on 25 October 2026: UTC+2 at its start, UTC+1 at its end.
      const { start, end } = params(exportRangeQuery('2026-10-25', '2026-10-25'));
      expect(start).toBe('2026-10-24T22:00:00.000Z');
      expect(end).toBe('2026-10-25T23:00:00.000Z');
    });
  });
});

describe('exportRangeSuffix', () => {
  test('names the file after its days', () => {
    expect(exportRangeSuffix('2026-10-26', '2026-10-30')).toBe('_2026-10-26_2026-10-30');
    expect(exportRangeSuffix('2026-10-26', '')).toBe('_2026-10-26_now');
    expect(exportRangeSuffix('', '2026-10-30')).toBe('_start_2026-10-30');
    expect(exportRangeSuffix('', '')).toBe('');
  });
});
