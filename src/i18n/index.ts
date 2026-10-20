import Vue from 'vue';
import VueI18n from 'vue-i18n';
import moment from 'moment';
import 'moment/locale/ar';
import 'moment/locale/de';
import 'moment/locale/es';
import 'moment/locale/fr';
import 'moment/locale/hi';
import 'moment/locale/ja';
import 'moment/locale/pt-br';
import 'moment/locale/ru';
import 'moment/locale/sv';
import 'moment/locale/uk';
import 'moment/locale/zh-cn';

import ar from './locales/ar';
import de from './locales/de';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import hi from './locales/hi';
import ja from './locales/ja';
import ptBR from './locales/pt-BR';
import ru from './locales/ru';
import sv from './locales/sv';
import uk from './locales/uk';
import zhCN from './locales/zh-CN';

Vue.use(VueI18n);

export type AppLocale =
  | 'ar'
  | 'de'
  | 'en'
  | 'es'
  | 'fr'
  | 'hi'
  | 'ja'
  | 'pt-BR'
  | 'ru'
  | 'sv'
  | 'uk'
  | 'zh-CN';

const SUPPORTED: AppLocale[] = [
  'ar',
  'de',
  'en',
  'es',
  'fr',
  'hi',
  'ja',
  'pt-BR',
  'ru',
  'sv',
  'uk',
  'zh-CN',
];

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return SUPPORTED.includes(value as AppLocale);
}

const HTML_LANG: Record<AppLocale, string> = {
  ar: 'ar',
  de: 'de',
  en: 'en',
  es: 'es',
  fr: 'fr',
  hi: 'hi',
  ja: 'ja',
  'pt-BR': 'pt-BR',
  ru: 'ru',
  sv: 'sv',
  uk: 'uk',
  'zh-CN': 'zh-CN',
};

function detectBrowserLocale(): AppLocale | null {
  if (typeof navigator === 'undefined') {
    return null;
  }
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('ar')) return 'ar';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('es')) return 'es';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('hi')) return 'hi';
  if (lang.startsWith('ja')) return 'ja';
  // Brazilian Portuguese is the only Portuguese variant; pt-PT users get it too.
  if (lang.startsWith('pt')) return 'pt-BR';
  if (lang.startsWith('ru')) return 'ru';
  if (lang.startsWith('sv')) return 'sv';
  if (lang.startsWith('uk')) return 'uk';
  if (lang.startsWith('zh')) return 'zh-CN';
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
  ar: 'ar',
  de: 'de',
  en: 'en',
  es: 'es',
  fr: 'fr',
  hi: 'hi',
  ja: 'ja',
  'pt-BR': 'pt-br',
  ru: 'ru',
  sv: 'sv',
  uk: 'uk',
  'zh-CN': 'zh-cn',
};

const initialLocale = getInitialLocale();

export const i18n = new VueI18n({
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: {
    ar,
    de,
    en,
    es,
    fr,
    hi,
    ja,
    'pt-BR': ptBR,
    ru,
    sv,
    uk,
    'zh-CN': zhCN,
  },
  silentTranslationWarn: process.env.NODE_ENV === 'production',
});

// moment's `ar` locale renders Arabic-Indic digits, while the translated UI strings
// and every number the app formats itself use Western digits. Keep dates consistent.
// updateLocale also activates `ar` globally, so it must run before the line below.
moment.updateLocale('ar', {
  preparse: (s: string) => s,
  postformat: (s: string) => s,
});

// moment's `hi` locale renders Devanagari digits, while CLDR's default number
// system for Hindi (and the rest of this UI) is Latin digits. Keep dates consistent.
// updateLocale also activates `hi` globally, so it must run before the line below.
moment.updateLocale('hi', {
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
