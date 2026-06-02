import Vue from 'vue';
import VueI18n from 'vue-i18n';
import moment from 'moment';
import 'moment/locale/uk';
import 'moment/locale/de';
import 'moment/locale/ru';

import en from './locales/en';
import uk from './locales/uk';
import de from './locales/de';
import ru from './locales/ru';

Vue.use(VueI18n);

export type AppLocale = 'en' | 'uk' | 'de' | 'ru';

const SUPPORTED: AppLocale[] = ['en', 'uk', 'de', 'ru'];

export function isAppLocale(value: string): value is AppLocale {
  return SUPPORTED.includes(value as AppLocale);
}

const HTML_LANG: Record<AppLocale, string> = {
  en: 'en',
  uk: 'uk',
  de: 'de',
  ru: 'ru',
};

function detectBrowserLocale(): AppLocale | null {
  if (typeof navigator === 'undefined') {
    return null;
  }
  const lang = (navigator.language || '').toLowerCase();
  if (lang.startsWith('uk')) return 'uk';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('ru')) return 'ru';
  if (lang.startsWith('en')) return 'en';
  return null;
}

export function getInitialLocale(): AppLocale {
  try {
    const saved = localStorage.getItem('locale');
    if (isAppLocale(saved)) {
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
};

const initialLocale = getInitialLocale();

export const i18n = new VueI18n({
  locale: initialLocale,
  fallbackLocale: 'en',
  messages: { en, uk, de, ru },
  silentTranslationWarn: true,
});

moment.locale(MOMENT_LOCALE[initialLocale]);

export function setAppLocale(locale: string): void {
  const next = isAppLocale(locale) ? locale : 'en';
  i18n.locale = next;
  moment.locale(MOMENT_LOCALE[next]);
  document.documentElement.lang = HTML_LANG[next];
  try {
    localStorage.setItem('locale', next);
  } catch {
    /* ignore */
  }
}
