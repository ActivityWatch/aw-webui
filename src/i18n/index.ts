import Vue from 'vue';
import VueI18n from 'vue-i18n';
import moment from 'moment';
import 'moment/locale/uk';
import 'moment/locale/de';
import 'moment/locale/ru';
import 'moment/locale/sv';
import 'moment/locale/zh-cn';
import 'moment/locale/es';
import 'moment/locale/ar';

import en from './locales/en';
import uk from './locales/uk';
import de from './locales/de';
import ru from './locales/ru';
import sv from './locales/sv';
import zhCN from './locales/zh-CN';
import es from './locales/es';
import ar from './locales/ar';

Vue.use(VueI18n);

export type AppLocale = 'en' | 'uk' | 'de' | 'ru' | 'zh-CN' | 'sv' | 'es' | 'ar';

const SUPPORTED: AppLocale[] = ['en', 'uk', 'de', 'ru', 'zh-CN', 'sv', 'es', 'ar'];

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return SUPPORTED.includes(value as AppLocale);
}

const HTML_LANG: Record<AppLocale, string> = {
  en: 'en',
  uk: 'uk',
  de: 'de',
  ru: 'ru',
  'zh-CN': 'zh-CN',
  sv: 'sv',
  es: 'es',
  ar: 'ar',
};

function detectBrowserLocale(): AppLocale | null {
  if (typeof navigator === 'undefined') {
    return null;
  }
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('uk')) return 'uk';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('ru')) return 'ru';
  if (lang.startsWith('zh')) return 'zh-CN';
  if (lang.startsWith('sv')) return 'sv';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('ar')) return 'ar';
  if (lang.startsWith('en')) return 'en';
  return null;
}

export function getInitialLocale(): AppLocale {
  try {
    const saved = localStorage.getItem('locale');
    if (saved !== null && isAppLocale(saved)) {
      return saved;
    }
  } catch {
    /* ignore */
  }
  return detectBrowserLocale() ?? 'en';
}

const MOMENT_LOCALE: Record<AppLocale, string> = {
  en: 'en',
  uk: 'uk',
  de: 'de',
  ru: 'ru',
  'zh-CN': 'zh-cn',
  sv: 'sv',
  es: 'es',
  ar: 'ar',
};

const initialLocale = getInitialLocale();

export const i18n = new VueI18n({
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: { en, uk, de, ru, 'zh-CN': zhCN, sv, es, ar },
  silentTranslationWarn: process.env.NODE_ENV === 'production',
});

// moment's `ar` locale renders Arabic-Indic digits, while the translated UI strings
// and every number the app formats itself use Western digits. Keep dates consistent.
// updateLocale also activates `ar` globally, so it must run before the line below.
moment.updateLocale('ar', {
  preparse: (s: string) => s,
  postformat: (s: string) => s,
});

const RTL_LOCALES: AppLocale[] = ['ar'];

export function isRtlLocale(locale: AppLocale): boolean {
  return RTL_LOCALES.includes(locale);
}

function applyDocumentLocale(locale: AppLocale): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = HTML_LANG[locale];
  document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
}

moment.locale(MOMENT_LOCALE[initialLocale]);
applyDocumentLocale(initialLocale);

export function setAppLocale(locale: string): void {
  const next = isAppLocale(locale) ? locale : 'en';
  i18n.locale = next;
  moment.locale(MOMENT_LOCALE[next]);
  applyDocumentLocale(next);
  try {
    localStorage.setItem('locale', next);
  } catch {
    /* ignore */
  }
}
