/**
 * @jest-environment node
 */

import { androidExportFromUrl } from '../../src/util/export';

describe('androidExportFromUrl', () => {
  afterEach(() => {
    // @ts-expect-error test cleanup
    delete global.window;
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
