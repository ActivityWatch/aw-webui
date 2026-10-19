import Vue from 'vue';
import VueI18n from 'vue-i18n';
import moment from 'moment';
import 'moment/locale/ar';
import 'moment/locale/bn';
import 'moment/locale/de';
import 'moment/locale/es';
import 'moment/locale/fr';
import 'moment/locale/hi';
import 'moment/locale/ja';
import 'moment/locale/pt-br';
import 'moment/locale/ru';
import 'moment/locale/sv';
import 'moment/locale/sw';
import 'moment/locale/uk';
import 'moment/locale/ur';
import 'moment/locale/zh-cn';

import ar from './locales/ar';
import bn from './locales/bn';
import de from './locales/de';
import en from './locales/en';
import es from './locales/es';
import fr from './locales/fr';
import hi from './locales/hi';
import ja from './locales/ja';
import ptBR from './locales/pt-BR';
import ru from './locales/ru';
import sv from './locales/sv';
import sw from './locales/sw';
import uk from './locales/uk';
import ur from './locales/ur';
import zhCN from './locales/zh-CN';

Vue.use(VueI18n);

export type AppLocale =
  | 'ar'
  | 'bn'
  | 'de'
  | 'en'
  | 'es'
  | 'fr'
  | 'hi'
  | 'ja'
  | 'pt-BR'
  | 'ru'
  | 'sv'
  | 'sw'
  | 'uk'
  | 'ur'
  | 'zh-CN';

export const SUPPORTED: AppLocale[] = [
  'ar',
  'bn',
  'de',
  'en',
  'es',
  'fr',
  'hi',
  'ja',
  'pt-BR',
  'ru',
  'sv',
  'sw',
  'uk',
  'ur',
  'zh-CN',
];

/**
 * Each language's name in that language (its endonym), shown in the language picker
 * regardless of the active UI locale. Kept here, not in the locale files, so adding a
 * locale only touches this list instead of every locale file.
 */
export const LANGUAGE_NAMES: Record<AppLocale, string> = {
  ar: 'العربية',
  bn: 'বাংলা',
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  hi: 'हिन्दी',
  ja: '日本語',
  'pt-BR': 'Português (Brasil)',
  ru: 'Русский',
  sv: 'Svenska',
  sw: 'Kiswahili',
  uk: 'Українська',
  ur: 'اردو',
  'zh-CN': '简体中文',
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return SUPPORTED.includes(value as AppLocale);
}

const HTML_LANG: Record<AppLocale, string> = {
  ar: 'ar',
  bn: 'bn',
  de: 'de',
  en: 'en',
  es: 'es',
  fr: 'fr',
  hi: 'hi',
  ja: 'ja',
  'pt-BR': 'pt-BR',
  ru: 'ru',
  sv: 'sv',
  sw: 'sw',
  uk: 'uk',
  ur: 'ur',
  'zh-CN': 'zh-CN',
};

function detectBrowserLocale(): AppLocale | null {
  if (typeof navigator === 'undefined') {
    return null;
  }
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('ar')) return 'ar';
  if (lang.startsWith('bn')) return 'bn';
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
  if (lang.startsWith('sw')) return 'sw';
  if (lang.startsWith('uk')) return 'uk';
  if (lang.startsWith('ur')) return 'ur';
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
  bn: 'bn',
  de: 'de',
  en: 'en',
  es: 'es',
  fr: 'fr',
  hi: 'hi',
  ja: 'ja',
  'pt-BR': 'pt-br',
  ru: 'ru',
  sv: 'sv',
  sw: 'sw',
  uk: 'uk',
  ur: 'ur',
  'zh-CN': 'zh-cn',
};

const initialLocale = getInitialLocale();

export const i18n = new VueI18n({
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: {
    ar,
    bn,
    de,
    en,
    es,
    fr,
    hi,
    ja,
    'pt-BR': ptBR,
    ru,
    sv,
    sw,
    uk,
    ur,
    'zh-CN': zhCN,
  },
  silentTranslationWarn: process.env.NODE_ENV === 'production',
});

// moment's `ur` locale already formats with Western digits, so it needs no override.
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

// moment's `bn` locale renders Bengali digits, while the translated UI strings
// and every number the app formats itself use Western digits. Keep dates consistent.
moment.updateLocale('bn', {
  preparse: (s: string) => s,
  postformat: (s: string) => s,
});

// One entry per line (prettier would join them), so RTL locale PRs never edit the same line.
// prettier-ignore
const RTL_LOCALES: AppLocale[] = [
  'ar',
  'ur',
];

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
