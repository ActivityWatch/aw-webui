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
