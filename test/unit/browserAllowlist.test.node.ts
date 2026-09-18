import { isBrowserAllowlistMiss } from '~/util/browserAllowlist';

describe('isBrowserAllowlistMiss', () => {
  const empty = { available: true, duration: 0, top_domains: [] as unknown[] };

  test('true when a browser bucket exists but the window intersection is empty', () => {
    expect(isBrowserAllowlistMiss(empty)).toBe(true);
  });

  test('false while the query is still in flight (null fields)', () => {
    expect(isBrowserAllowlistMiss({ ...empty, top_domains: null })).toBe(false);
  });

  test('false when no browser watcher bucket is present', () => {
    expect(isBrowserAllowlistMiss({ ...empty, available: false })).toBe(false);
  });

  test('false when matched browser events exist', () => {
    expect(isBrowserAllowlistMiss({ available: true, duration: 12, top_domains: [{}] })).toBe(
      false
    );
  });
});
