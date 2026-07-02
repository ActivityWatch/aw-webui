import Vue from 'vue';
import VueI18n from 'vue-i18n';
import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

Vue.use(VueI18n);

const LOCALE_KEY = 'aw-locale';

const savedLocale = localStorage.getItem(LOCALE_KEY) || 'en';

export const i18n = new VueI18n({
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: {
    en,
    'zh-CN': zhCN,
  },
});

export function setLocale(locale) {
  i18n.locale = locale;
  localStorage.setItem(LOCALE_KEY, locale);
}

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '中文（简体）' },
];
