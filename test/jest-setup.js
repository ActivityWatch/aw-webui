import Vue from 'vue';
import en from '~/i18n/locales/en';

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
//
// Note: Vue.use(VueI18n) is called at module-load time via the stores/settings
// import chain, which overwrites Vue.prototype.$t with vue-i18n's version. That
// version requires a _i18n instance on the component that tests don't provide.
// Re-applying the stub in beforeEach ensures tests always see the safe version.
const $t = (key, params) => {
  const result = lookup(en, key.split('.'));
  if (result === null) return key;
  if (!params) return result;
  return result.replace(/\{(\w+)\}/g, (_, k) =>
    params[k] !== undefined ? String(params[k]) : `{${k}}`
  );
};
const $tc = (key, _count, params) => $t(key, params);

Vue.prototype.$t = $t;
Vue.prototype.$tc = $tc;

beforeEach(() => {
  Vue.prototype.$t = $t;
  Vue.prototype.$tc = $tc;
});
