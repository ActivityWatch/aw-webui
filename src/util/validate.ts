// Loaded lazily with webpackIgnore so the bundle doesn't pull in Node's zlib.
// In Node.js (Jest) the real package resolves; in browser builds the require
// throws (module excluded from bundle) and we fall back to an empty set.
// When the database is unavailable, \N{...} patterns are rejected outright
// (fail-safe) rather than passed through for server-side validation.
type UnicodeAliases = Record<string, string[]>;

let _unicodeNames: Map<number, string> | null = null;
let _unicodeAliases: UnicodeAliases[] = [];
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _unicodeNames = require('@unicode/unicode-13.0.0/Names');
  _unicodeAliases = [
    // Python's \N{...} lookup accepts NameAliases.txt aliases too.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@unicode/unicode-13.0.0/Names/Abbreviation'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@unicode/unicode-13.0.0/Names/Alternate'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@unicode/unicode-13.0.0/Names/Control'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@unicode/unicode-13.0.0/Names/Correction'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@unicode/unicode-13.0.0/Names/Figment'),
  ];
} catch {
  // browser build: Unicode package excluded from bundle; \N{...} patterns will
  // be rejected outright by hasPythonInvalidEscape (fail-safe behavior).
}

const PYTHON_INVALID_IDENTITY_ESCAPE = /\\[CEFGHIJKLMOPQRTVXYceghijklmopqyz]/;
const PYTHON_INCOMPLETE_ESCAPE =
  /\\(?:N(?!\{[^}]+\})|u(?![0-9A-Fa-f]{4})|U(?![0-9A-Fa-f]{8})|x(?![0-9A-Fa-f]{2}))/;
const PYTHON_UNICODE_NAMES = new Set([
  ...(_unicodeNames?.values() ?? []),
  ..._unicodeAliases.flatMap(aliases => Object.values(aliases).flat()),
]);

function hasJavaScriptNamedGroup(re: string): boolean {
  let inClass = false;
  let escaped = false;

  for (let index = 0; index < re.length; index += 1) {
    const char = re[index];
    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (char === '[' && !inClass) {
      inClass = true;
    } else if (char === ']' && inClass) {
      inClass = false;
    } else if (!inClass && re.startsWith('(?<', index) && !['=', '!'].includes(re[index + 3])) {
      return true;
    }
  }

  return false;
}

function hasPythonInvalidEscape(re: string): boolean {
  // Ignore escaped backslashes: only an odd-length run introduces an escape.
  const escapes = re.replace(/\\\\/g, '');
  // JavaScript accepts unknown letter escapes and legacy numeric escapes as
  // literals without the Unicode flag. Python rejects the former and treats
  // the latter as backreferences, which fail if the group does not exist.
  if (
    PYTHON_INVALID_IDENTITY_ESCAPE.test(escapes) ||
    PYTHON_INCOMPLETE_ESCAPE.test(escapes) ||
    /\\[1-9]/.test(escapes)
  ) {
    return true;
  }

  // If the name database is unavailable (browser build), reject any \N{...}
  // rather than accepting unknown names. Fail-safe: unknown names would cause
  // Python's re module to raise re.error at category-match time.
  if (PYTHON_UNICODE_NAMES.size === 0) {
    return /\\N\{[^}]+\}/.test(escapes);
  }
  return [...escapes.matchAll(/\\N\{([^}]+)\}/g)].some(
    match => !PYTHON_UNICODE_NAMES.has(match[1])
  );
}

export function validateRegex(re: string) {
  // validates if pattern is a valid regex in both JavaScript and Python
  // returns true if regex is valid
  if (re === '') return false;
  try {
    new RegExp(re);
  } catch (e) {
    return false;
  }
  // Reject JS-only syntax that Python's re module doesn't support.
  // JS named groups (?<name>...) are valid JS but invalid Python (Python uses (?P<name>...)).
  // Lookbehind (?<=...) and (?<!...) are valid in both, so we allow those.
  if (hasJavaScriptNamedGroup(re) || hasPythonInvalidEscape(re)) {
    return false;
  }
  return true;
}

export function isRegexBroad(re: string | RegExp) {
  // checks if a regex is overly broad or not (for the purpose of a category rule)
  // returns true if regex is overly broad
  if (typeof re === 'string') {
    re = new RegExp(re);
  }
  // if pattern less than 3 characters, it's too broad
  if (re.source.length < 3) return true;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  return re.test(
    'THIS STRING SHOULD PROBABLY NOT MATCH: ' + alphabet + alphabet.toUpperCase() + numbers
  );
}
