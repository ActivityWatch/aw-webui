import {
  preferKnownHostnames,
  selectSoleKnownHostname,
  categoryBuilderHostnameEmptyKind,
} from '~/util/hostnames';

describe('preferKnownHostnames', () => {
  test('moves unknown to the end when a known host exists', () => {
    expect(preferKnownHostnames(['unknown', 'laptop_ori'])).toEqual(['laptop_ori', 'unknown']);
  });

  test('preserves the original order for known hosts', () => {
    expect(preferKnownHostnames(['desktop', 'laptop', 'unknown'])).toEqual([
      'desktop',
      'laptop',
      'unknown',
    ]);
  });

  test('keeps unknown when it is the only host', () => {
    expect(preferKnownHostnames(['unknown'])).toEqual(['unknown']);
  });
});

describe('selectSoleKnownHostname', () => {
  test('returns the only non-unknown host', () => {
    expect(selectSoleKnownHostname(['laptop'])).toBe('laptop');
  });

  test('returns the only known host even when unknown is also present', () => {
    expect(selectSoleKnownHostname(['unknown', 'laptop'])).toBe('laptop');
  });

  test('returns undefined when several known hosts exist', () => {
    expect(selectSoleKnownHostname(['laptop', 'desktop'])).toBeUndefined();
  });

  test('returns undefined when hosts is empty', () => {
    expect(selectSoleKnownHostname([])).toBeUndefined();
  });

  test('returns undefined when only unknown exists', () => {
    expect(selectSoleKnownHostname(['unknown'])).toBeUndefined();
  });

  test('ignores empty/falsy host strings', () => {
    expect(selectSoleKnownHostname(['', undefined as unknown as string, 'laptop'])).toBe('laptop');
  });
});

describe('categoryBuilderHostnameEmptyKind', () => {
  test('is null when a hostname is already selected', () => {
    expect(categoryBuilderHostnameEmptyKind(['laptop'], 'laptop')).toBeNull();
  });

  test('is no-hosts when there are no hosts at all', () => {
    expect(categoryBuilderHostnameEmptyKind([], undefined)).toBe('no-hosts');
  });

  test('is hostname-unselected when hosts exist but none is chosen', () => {
    expect(categoryBuilderHostnameEmptyKind(['laptop', 'desktop'], undefined)).toBe(
      'hostname-unselected'
    );
  });

  test('is hostname-unselected when only unknown is listed', () => {
    expect(categoryBuilderHostnameEmptyKind(['unknown'], undefined)).toBe('hostname-unselected');
  });

  test('treats empty string hostname as unselected when hosts exist', () => {
    expect(categoryBuilderHostnameEmptyKind(['laptop'], '')).toBe('hostname-unselected');
  });
});
