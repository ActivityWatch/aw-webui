import {
  isMultideviceNoteDismissed,
  persistMultideviceNoteDismissed,
} from '~/util/multideviceNote';

describe('multi-device note dismissal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('is shown until dismissed', () => {
    expect(isMultideviceNoteDismissed()).toBe(false);
  });

  test('stays dismissed once dismissed', () => {
    persistMultideviceNoteDismissed();
    expect(isMultideviceNoteDismissed()).toBe(true);
  });
});
