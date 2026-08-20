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

/** Split s on top-level `|` (not inside groups or character classes). */
function splitTopLevelPipe(s: string): string[] {
  const result: string[] = [];
  let start = 0;
  let depth = 0;
  let inClass = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (s[i] === '\\') {
      escaped = true;
      continue;
    }
    if (s[i] === '[' && !inClass) {
      inClass = true;
      continue;
    }
    if (s[i] === ']' && inClass) {
      inClass = false;
      continue;
    }
    if (inClass) continue;
    if (s[i] === '(') {
      depth++;
      continue;
    }
    if (s[i] === ')') {
      depth--;
      continue;
    }
    if (s[i] === '|' && depth === 0) {
      result.push(s.slice(start, i));
      start = i + 1;
    }
  }
  result.push(s.slice(start));
  return result;
}

/**
 * Apply the quantifier at position i in s to an atom of baseWidth.
 * Returns { added, newI } — added is null if variable-width.
 */
function applyQuantifier(
  s: string,
  i: number,
  baseWidth: number
): { added: number | null; newI: number } {
  if (i >= s.length) return { added: baseWidth, newI: i };
  if (s[i] === '+' || s[i] === '*') return { added: null, newI: i + 1 };
  if (s[i] === '?') return { added: null, newI: i + 1 };
  if (s[i] === '{') {
    const closeBrace = s.indexOf('}', i + 1);
    if (closeBrace !== -1) {
      const inner = s.slice(i + 1, closeBrace);
      let newI = closeBrace + 1;
      if (newI < s.length && s[newI] === '?') newI++; // skip lazy modifier
      if (inner.includes(',')) {
        const [lo, hi] = inner.split(',', 2);
        if (hi === '' || lo !== hi) return { added: null, newI };
        const n = parseInt(lo, 10);
        return isNaN(n) ? { added: null, newI } : { added: baseWidth * n, newI };
      }
      const n = parseInt(inner, 10);
      return isNaN(n) ? { added: null, newI } : { added: baseWidth * n, newI };
    }
  }
  return { added: baseWidth, newI: i };
}

/**
 * Compute the exact fixed width that pattern s always matches.
 * Returns null if variable-width or undetermined.
 * Handles alternation: all branches must have the same fixed width.
 */
function computePatternWidth(s: string): number | null {
  const alts = splitTopLevelPipe(s);
  if (alts.length > 1) {
    const widths = alts.map(computePatternWidth);
    if (widths.some(w => w === null)) return null;
    const unique = new Set(widths);
    return unique.size === 1 ? (widths[0] as number) : null;
  }

  let width = 0;
  let i = 0;
  let inClass = false;
  let escaped = false;

  while (i < s.length) {
    if (escaped) {
      escaped = false;
      // Advance past the escaped character itself (e.g., 'd' in '\d') so
      // that the quantifier check starts at the character after it.
      i++;
      const q = applyQuantifier(s, i, 1);
      if (q.added === null) return null;
      width += q.added;
      i = q.newI;
      continue;
    }
    if (s[i] === '\\') {
      escaped = true;
      i++;
      continue;
    }
    if (s[i] === '[' && !inClass) {
      inClass = true;
      i++;
      continue;
    }
    if (s[i] === ']' && inClass) {
      inClass = false;
      i++;
      const q = applyQuantifier(s, i, 1);
      if (q.added === null) return null;
      width += q.added;
      i = q.newI;
      continue;
    }
    if (inClass) {
      i++;
      continue;
    }

    if (s[i] === '(') {
      // Find matching close paren
      let depth = 1;
      let j = i + 1;
      let ic = false;
      let esc = false;
      while (j < s.length && depth > 0) {
        if (esc) {
          esc = false;
          j++;
          continue;
        }
        if (s[j] === '\\') {
          esc = true;
          j++;
          continue;
        }
        if (s[j] === '[' && !ic) {
          ic = true;
          j++;
          continue;
        }
        if (s[j] === ']' && ic) {
          ic = false;
          j++;
          continue;
        }
        if (!ic) {
          if (s[j] === '(') depth++;
          else if (s[j] === ')') depth--;
        }
        j++;
      }
      let inner = s.slice(i + 1, j - 1);
      i = j;

      // Lookahead/lookbehind — zero width (they assert position, consume nothing)
      if (/^\?[=!]/.test(inner) || /^\?<[=!]/.test(inner)) {
        const q = applyQuantifier(s, i, 0);
        if (q.added === null) return null;
        width += q.added;
        i = q.newI;
        continue;
      }
      // Strip non-capturing group prefix (?:, inline flags (?i:, etc.)
      inner = inner.replace(/^\?[a-z]*:/, '');

      const groupWidth = computePatternWidth(inner);
      if (groupWidth === null) return null;
      const q = applyQuantifier(s, i, groupWidth);
      if (q.added === null) return null;
      width += q.added;
      i = q.newI;
      continue;
    }

    if (s[i] === '+' || s[i] === '*') return null;
    if (s[i] === '?') return null; // bare ? (not after a group modifier)
    if (s[i] === '{' || s[i] === ')') {
      i++;
      continue;
    } // malformed — skip

    // Regular character: width 1
    i++;
    const q = applyQuantifier(s, i, 1);
    if (q.added === null) return null;
    width += q.added;
    i = q.newI;
  }
  return width;
}

function lookbehindIsVariableWidth(s: string): boolean {
  // Python's re requires all lookbehind branches to match a fixed number of
  // characters. Variable quantifiers (+, *, ?, {m,n}) AND alternation branches
  // with different fixed widths (e.g. (?<=\d{2}|[a-z]{3})) both cause re.error.
  return computePatternWidth(s) === null;
}

function hasPythonInvalidLookbehind(re: string): boolean {
  // Python's re module only supports fixed-width lookbehind.
  // Variable-width lookbehind (e.g. (?<=\d+)foo) is valid JS but raises
  // re.error in Python at compile time, breaking server-side categorization.
  // This also catches equal-width-check failures: (?<=\d{2}|[a-z]{3}) has
  // alternation branches with different widths (2 vs 3), which Python rejects.
  let i = 0;
  let inClass = false;
  let escaped = false;
  while (i < re.length) {
    if (escaped) {
      escaped = false;
      i++;
      continue;
    }
    if (re[i] === '\\') {
      escaped = true;
      i++;
      continue;
    }
    if (re[i] === '[' && !inClass) {
      inClass = true;
      i++;
      continue;
    }
    if (re[i] === ']' && inClass) {
      inClass = false;
      i++;
      continue;
    }
    if (inClass) {
      i++;
      continue;
    }
    // Detect lookbehind: (?<= or (?<!
    if (re.startsWith('(?<=', i) || re.startsWith('(?<!', i)) {
      const start = i + 4; // skip (?<= or (?<!
      // Find matching close paren
      let depth = 1;
      let j = start;
      let ic = false;
      let esc = false;
      while (j < re.length && depth > 0) {
        if (esc) {
          esc = false;
          j++;
          continue;
        }
        if (re[j] === '\\') {
          esc = true;
          j++;
          continue;
        }
        if (re[j] === '[' && !ic) {
          ic = true;
          j++;
          continue;
        }
        if (re[j] === ']' && ic) {
          ic = false;
          j++;
          continue;
        }
        if (!ic) {
          if (re[j] === '(') depth++;
          else if (re[j] === ')') depth--;
        }
        j++;
      }
      const body = re.slice(start, j - 1);
      if (lookbehindIsVariableWidth(body)) return true;
      i = j;
      continue;
    }
    i++;
  }
  return false;
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
  if (hasJavaScriptNamedGroup(re) || hasPythonInvalidEscape(re) || hasPythonInvalidLookbehind(re)) {
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
