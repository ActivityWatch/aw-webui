const PYTHON_INVALID_IDENTITY_ESCAPE = /\\[CEFGHIJKLMOPQRTVXYceghijklmnopqyz]/;
const PYTHON_INCOMPLETE_ESCAPE =
  /\\(?:N(?!\{[^}]+\})|u(?![0-9A-Fa-f]{4})|U(?![0-9A-Fa-f]{8})|x(?![0-9A-Fa-f]{2}))/;

function hasPythonInvalidEscape(re: string): boolean {
  // Ignore escaped backslashes: only an odd-length run introduces an escape.
  const escapes = re.replace(/\\\\/g, '');
  // JavaScript accepts unknown letter escapes and legacy numeric escapes as
  // literals without the Unicode flag. Python rejects the former and treats
  // the latter as backreferences, which fail if the group does not exist.
  return (
    PYTHON_INVALID_IDENTITY_ESCAPE.test(escapes) ||
    PYTHON_INCOMPLETE_ESCAPE.test(escapes) ||
    /\\[1-9]/.test(escapes)
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
  if (/\(\?<(?![=!])/.test(re) || hasPythonInvalidEscape(re)) {
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
