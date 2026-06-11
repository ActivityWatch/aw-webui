import Vue from 'vue';

import en from './locales/en';
import zhCN from './locales/zh-CN';

export type SupportedLocale = 'en' | 'zh-CN';
export type TranslationParams = Record<string, string | number | boolean | null | undefined>;

type TranslationValue = string | TranslationTree;
type TranslationTree = {
  [key: string]: TranslationValue;
};

export const DEFAULT_LOCALE: SupportedLocale = 'en';
export const SUPPORTED_LOCALES: Array<{ code: SupportedLocale; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'zh-CN', label: '简体中文' },
];

const messages: Record<SupportedLocale, TranslationTree> = {
  en,
  'zh-CN': zhCN,
};

const state = Vue.observable<{ locale: SupportedLocale }>({
  locale: DEFAULT_LOCALE,
});

function resolveKey(locale: SupportedLocale, key: string): string | undefined {
  const value = key.split('.').reduce<TranslationValue | undefined>((current, part) => {
    if (!current || typeof current === 'string') {
      return undefined;
    }

    return current[part];
  }, messages[locale]);

  return typeof value === 'string' ? value : undefined;
}

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.some(supportedLocale => supportedLocale.code === locale);
}

export function setLocale(locale: string | null | undefined): void {
  state.locale = locale && isSupportedLocale(locale) ? locale : DEFAULT_LOCALE;
}

export function getLocale(): SupportedLocale {
  return state.locale;
}

export function interpolate(message: string, params: TranslationParams = {}): string {
  return message.replace(/\{([^{}]+)\}/g, (placeholder, name: string) => {
    const value = params[name];

    return value === undefined || value === null ? placeholder : String(value);
  });
}

export function translate(
  key: string,
  locale: SupportedLocale = state.locale,
  params?: TranslationParams
): string {
  const message = resolveKey(locale, key) ?? resolveKey(DEFAULT_LOCALE, key) ?? key;

  return interpolate(message, params);
}

export function t(key: string, params?: TranslationParams): string {
  return translate(key, state.locale, params);
}

export function installI18n(): void {
  Vue.prototype.$t = t;
}
