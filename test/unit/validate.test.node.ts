import { validateRegex, isRegexBroad } from '~/util/validate';

describe('validateRegex', () => {
  test('accepts valid patterns', () => {
    expect(validateRegex('Notepad\\+\\+')).toBe(true);
    expect(validateRegex('Chrome|Firefox')).toBe(true);
    expect(validateRegex('.*\\.py$')).toBe(true);
    expect(validateRegex('[a-z]+')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(validateRegex('')).toBe(false);
  });

  test('rejects invalid patterns', () => {
    // ++ is invalid: nothing to repeat for the second +
    expect(validateRegex('Notepad++')).toBe(false);
    // Unclosed group
    expect(validateRegex('(foo')).toBe(false);
    // Unclosed character class
    expect(validateRegex('[foo')).toBe(false);
    // Invalid quantifier
    expect(validateRegex('a{2,1}')).toBe(false);
  });
});

describe('isRegexBroad', () => {
  test('flags single-char patterns as broad', () => {
    expect(isRegexBroad('a')).toBe(true);
  });

  test('flags patterns that match common strings as broad', () => {
    expect(isRegexBroad('.*')).toBe(true);
  });

  test('does not flag specific patterns as broad', () => {
    expect(isRegexBroad('Notepad\\+\\+')).toBe(false);
    expect(isRegexBroad('MySpecificApp')).toBe(false);
  });
});
