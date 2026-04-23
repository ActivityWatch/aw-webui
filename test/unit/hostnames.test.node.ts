import { preferKnownHostnames } from '~/util/hostnames';

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
