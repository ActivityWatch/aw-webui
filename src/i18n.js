import Vue from 'vue';
import VueI18n from 'vue-i18n';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

Vue.use(VueI18n);

const LOCALE_KEY = 'aw-locale';

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '中文（简体）' },
];

function isSupportedLocale(locale) {
  return SUPPORTED_LOCALES.some(l => l.code === locale);
}

function readStoredLocale() {
  try {
    const locale = localStorage.getItem(LOCALE_KEY);
    return isSupportedLocale(locale) ? locale : 'en';
  } catch {
    return 'en';
  }
}

const savedLocale = readStoredLocale();

export const i18n = new VueI18n({
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
  },
});

export function setLocale(locale) {
  if (!isSupportedLocale(locale)) {
    console.warn(`[i18n] Unsupported locale: ${locale}`);
    return;
  }

  i18n.locale = locale;
  try {
    localStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // Storage can be blocked in private browsing or hardened browser profiles.
  }
}
