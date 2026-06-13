export function validateRegex(re: string) {
  // validates if pattern is a valid regex
  // returns true if regex is valid
  if (re === '') return false;
  try {
    new RegExp(re);
  } catch (e) {
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

/**
 * Split a combined regex string into individual patterns by top-level `|`.
 * Parenthesized groups like (…), (?:…), (?=…) are traversed with depth
 * tracking so a pipe inside a group doesn't trigger a split.
 *
 * Users who need a literal | in a single rule can escape it with \|.
 */
export function splitRegexPipe(regex: string): string[] {
  if (!regex) return [];
  // Bail out of the smart split for pathological inputs — pipe-joined
  // rule sets shouldn't realistically exceed 1 000 characters.
  if (regex.length > 1000) {
    return [regex];
  }
  const parts: string[] = [];
  let depth = 0;       // paren-nesting depth — skip | when inside a group
  let escaping = false; // simple \-escape for \|
  let start = 0;
  for (let i = 0; i < regex.length; i++) {
    const ch = regex[i];
    if (escaping) {
      escaping = false;
      continue;
    }
    if (ch === '\\') {
      escaping = true;
      continue;
    }
    if (ch === '(') {
      depth++;
      continue;
    }
    if (ch === ')') {
      if (depth > 0) depth--;
      continue;
    }
    if (ch === '|' && depth === 0) {
      parts.push(regex.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(regex.slice(start));
  return parts.filter(p => p.trim().length > 0);
}

/**
 * Joins an array of regex patterns into a single pipe-separated string.
 * Empty/whitespace-only entries are skipped.
 */
export function joinRegexPipe(patterns: string[]): string {
  return patterns
    .map(p => (p || '').trim())
    .filter(p => p.length > 0)
    .join('|');
}

/**
 * Validates each pattern in a list and returns per-pattern results.
 * `allValid` is true only when every pattern compiles successfully.
 */
export function validatePatternList(patterns: string[]): {
  allValid: boolean;
  results: { valid: boolean; broad: boolean }[];
} {
  const results = patterns
    .filter(p => (p || '').trim().length > 0)
    .map(p => ({
      valid: validateRegex(p.trim()),
      broad: isRegexBroad(p.trim()),
    }));
  return {
    allValid: results.every(r => r.valid),
    results,
  };
}

/**
 * Returns true if *any* pattern in the list is overly broad.
 */
export function isPatternListBroad(patterns: string[]): boolean {
  return patterns.some(p => isRegexBroad(p));
}
