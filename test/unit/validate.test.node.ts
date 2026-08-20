import { validateRegex, isRegexBroad } from '~/util/validate';

describe('validateRegex', () => {
  test('accepts valid patterns', () => {
    expect(validateRegex('Notepad\\+\\+')).toBe(true);
    expect(validateRegex('Chrome|Firefox')).toBe(true);
    expect(validateRegex('.*\\.py$')).toBe(true);
    expect(validateRegex('[a-z]+')).toBe(true);
  });

  test('accepts standard Python regex escape sequences', () => {
    // \n, \t, \r etc. are valid in both JS and Python regex
    expect(validateRegex('^app\\nwindow title$')).toBe(true);
    expect(validateRegex('foo\\tbar')).toBe(true);
    expect(validateRegex('line\\rend')).toBe(true);
    expect(validateRegex('\\n+')).toBe(true);
  });

  test('rejects empty string', () => {
    expect(validateRegex('')).toBe(false);
  });

  test('rejects JavaScript-invalid patterns', () => {
    // ++ is invalid: nothing to repeat for the second +
    expect(validateRegex('Notepad++')).toBe(false);
    // Unclosed group
    expect(validateRegex('(foo')).toBe(false);
    // Unclosed character class
    expect(validateRegex('[foo')).toBe(false);
    // Invalid quantifier
    expect(validateRegex('a{2,1}')).toBe(false);
  });

  test('rejects JavaScript-only syntax that Python does not support', () => {
    // JS named groups (?<name>...) are invalid in Python's re module
    expect(validateRegex('(?<name>foo)')).toBe(false);
    expect(validateRegex('(?<year>\\d{4})-(?<month>\\d{2})')).toBe(false);
    // JavaScript treats unknown letter escapes as literal characters, while Python rejects them
    expect(validateRegex('foo\\qbar')).toBe(false);
    expect(validateRegex('foo\\Cbar')).toBe(false);
    expect(validateRegex('foo\\8bar')).toBe(false);
  });

  test('validates Python named Unicode escapes', () => {
    expect(validateRegex('\\N{EM DASH}')).toBe(true);
    expect(validateRegex('foo\\N{EM DASH}bar')).toBe(true);
    expect(validateRegex('\\N{LF}')).toBe(true);
    expect(validateRegex('\\N{CR}')).toBe(true);
    expect(validateRegex('\\N{LINE FEED}')).toBe(true);
    expect(validateRegex('\\N{NOT A REAL UNICODE NAME}')).toBe(false);
  });

  test('ignores named-group text in literal regex contexts', () => {
    expect(validateRegex('[(?<]')).toBe(true);
    expect(validateRegex('\\(?<name>foo\\)')).toBe(true);
    expect(validateRegex('[abc](?<name>foo)')).toBe(false);
  });

  test('accepts lookbehind assertions (valid in both JS and Python)', () => {
    // Positive lookbehind (?<=...) is valid in both
    expect(validateRegex('(?<=foo)bar')).toBe(true);
    // Negative lookbehind (?<!...) is valid in both
    expect(validateRegex('(?<!foo)bar')).toBe(true);
    // Escaped backslashes and punctuation escapes are accepted by both engines
    expect(validateRegex('foo\\\\qbar')).toBe(true);
    expect(validateRegex('foo\\!bar')).toBe(true);
    // Fixed-width quantifiers inside lookbehind are valid
    expect(validateRegex('(?<=\\d{3})foo')).toBe(true);
    expect(validateRegex('(?<=abc)foo')).toBe(true);
    // Lookbehind with equal-width alternation is valid in Python
    expect(validateRegex('(?<=foo|bar)x')).toBe(true);
    expect(validateRegex('(?<=\\d{2}|[a-z]{2})x')).toBe(true);
  });

  test('rejects Python-invalid lookbehind (variable-width or unequal alternation)', () => {
    // Variable-width quantifiers in lookbehind: invalid in Python
    expect(validateRegex('(?<=\\d+)foo')).toBe(false);
    expect(validateRegex('(?<=a*)foo')).toBe(false);
    expect(validateRegex('(?<=a?)foo')).toBe(false);
    expect(validateRegex('(?<=\\d{2,3})foo')).toBe(false);
    // Alternation with different-width branches: Python raises re.error
    expect(validateRegex('(?<=\\d{2}|[a-z]{3})foo')).toBe(false);
    expect(validateRegex('(?<=a|ab)x')).toBe(false);
    // Nested lookbehind inside a lookbehind: Python's re does not support it
    expect(validateRegex('(?<=(?<=a)b)x')).toBe(false);
    expect(validateRegex('(?<=(?<!a)b)x')).toBe(false);
  });
});

describe('validateRegex - browser environment (Unicode DB unavailable)', () => {
  // Simulate the webpack IgnorePlugin that excludes @unicode packages from the browser bundle.
  // In that environment require('@unicode/unicode-13.0.0/Names') throws, PYTHON_UNICODE_NAMES
  // is an empty Set, and the validator must REJECT \N{...} patterns (fail-safe).
  let browserValidate: (re: string) => boolean;

  beforeAll(() => {
    jest.isolateModules(() => {
      const throwExcluded = () => {
        throw new Error('Module excluded from browser bundle');
      };
      jest.doMock('@unicode/unicode-13.0.0/Names', throwExcluded);
      jest.doMock('@unicode/unicode-13.0.0/Names/Abbreviation', throwExcluded);
      jest.doMock('@unicode/unicode-13.0.0/Names/Alternate', throwExcluded);
      jest.doMock('@unicode/unicode-13.0.0/Names/Control', throwExcluded);
      jest.doMock('@unicode/unicode-13.0.0/Names/Correction', throwExcluded);
      jest.doMock('@unicode/unicode-13.0.0/Names/Figment', throwExcluded);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      browserValidate = require('~/util/validate').validateRegex;
    });
  });

  afterAll(() => {
    jest.resetModules();
  });

  test('rejects \\N{VALID NAME} — cannot verify name without database', () => {
    expect(browserValidate('\\N{EM DASH}')).toBe(false);
    expect(browserValidate('foo\\N{LINE FEED}bar')).toBe(false);
  });

  test('rejects \\N{INVALID NAME} — same as valid: cannot verify', () => {
    expect(browserValidate('\\N{NOT A REAL UNICODE NAME}')).toBe(false);
  });

  test('accepts patterns with no \\N{...} escapes', () => {
    expect(browserValidate('Chrome|Firefox')).toBe(true);
    expect(browserValidate('.*\\.py$')).toBe(true);
    expect(browserValidate('foo\\\\qbar')).toBe(true);
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
