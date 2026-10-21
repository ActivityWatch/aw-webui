import { config } from '@vue/test-utils';
import en from '~/i18n/locales/en';
// Install vue-i18n now: modules importing ~/i18n later (e.g. the settings store)
// would otherwise replace the $t stub below with the real, instance-bound one.
import '~/i18n';

function lookup(obj, keys) {
  const [head, ...rest] = keys;
  if (obj === undefined || obj === null) return null;
  if (rest.length === 0) return typeof obj[head] === 'string' ? obj[head] : null;
  if (typeof obj[head] === 'object') return lookup(obj[head], rest);
  return null;
}

// Provide a global stub for Vue-i18n's $t so component tests that mount
// components with i18n strings don't crash with "$t is not a function".
// Uses the actual English translations so tests can match on readable strings.
// A test's own `mocks: { $t }` still takes precedence.
const t = (key, params) => {
  const result = lookup(en, key.split('.'));
  if (result === null) return key;
  if (!params) return result;
  return result.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
};
config.global.mocks.$t = t;
config.global.mocks.$tc = (key, _count, params) => t(key, params);
