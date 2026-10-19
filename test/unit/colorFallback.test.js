const mockGet = jest.fn();

jest.mock('~/util/awclient', () => ({
  getClient: () => ({ get: mockGet, req: { get: mockGet } }),
}));

import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { getCategoryColorFromString } from '~/util/color';

describe('fallback color follows the saved setting', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  test('enabled setting uses a generated fallback color without a legacy localStorage key', () => {
    useSettingsStore().useColorFallback = true;

    expect(getCategoryColorFromString('some-uncategorized-thing')).not.toBe('#CCC');
  });

  test('disabled setting returns the uncategorized color even with a stale localStorage key', () => {
    localStorage.useColorFallback = 'true';
    useSettingsStore().useColorFallback = false;

    expect(getCategoryColorFromString('some-uncategorized-thing')).toBe('#CCC');
  });
});
