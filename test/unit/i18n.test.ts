describe('i18n', () => {
  const loadI18n = () => {
    jest.resetModules();
    return require('~/i18n');
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });

  afterEach(() => {
    jest.resetModules();
  });

  test('isAppLocale accepts supported locales only', () => {
    const { isAppLocale } = loadI18n();
    expect(isAppLocale('en')).toBe(true);
    expect(isAppLocale('uk')).toBe(true);
    expect(isAppLocale('de')).toBe(true);
    expect(isAppLocale('ru')).toBe(true);
    expect(isAppLocale('zh-CN')).toBe(true);
    expect(isAppLocale('es')).toBe(true);
    expect(isAppLocale('ar')).toBe(true);
    expect(isAppLocale('hi')).toBe(true);
    expect(isAppLocale('ur')).toBe(true);
    expect(isAppLocale('ja')).toBe(true);
    expect(isAppLocale('ja-JP')).toBe(false);
    expect(isAppLocale('fr')).toBe(true);
    expect(isAppLocale('fr-FR')).toBe(false);
    expect(isAppLocale('pt-BR')).toBe(true);
    expect(isAppLocale('pt')).toBe(false);
    expect(isAppLocale('bn')).toBe(true);
    expect(isAppLocale('bn-BD')).toBe(false);
    expect(isAppLocale('id')).toBe(true);
    expect(isAppLocale('id-ID')).toBe(false);
    expect(isAppLocale('')).toBe(false);
    expect(isAppLocale(null)).toBe(false);
  });

  test('initial locale comes from localStorage when valid', () => {
    localStorage.setItem('locale', 'uk');
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('uk');
  });

  test('initial locale detects browser language', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'de-DE',
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('de');
  });

  test('initial locale detects Chinese browser language', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'zh-CN',
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('zh-CN');
  });

  test('initial locale detects Spanish browser language', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'es-MX',
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('es');
  });

  test('setAppLocale switches to Spanish messages', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('es');
    expect(i18n.locale).toBe('es');
    expect(i18n.t('common.save')).not.toBe('Save');
    expect(document.documentElement.lang).toBe('es');
    expect(localStorage.getItem('locale')).toBe('es');
  });

  test('initial Arabic locale sets lang and rtl direction on load', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'ar-EG',
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  test('switching to Arabic sets rtl and switching back restores ltr', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('ar');
    expect(i18n.locale).toBe('ar');
    expect(i18n.t('common.save')).not.toBe('Save');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('locale')).toBe('ar');
    setAppLocale('en');
    expect(document.documentElement.dir).toBe('ltr');
  });

  test('Arabic dates keep Western digits', () => {
    const { setAppLocale } = loadI18n();
    const moment = require('moment');
    setAppLocale('ar');
    expect(moment.locale()).toBe('ar');
    const formatted = moment('2026-10-19T19:23:00').format('LLLL');
    expect(formatted).toContain('19');
    expect(formatted).not.toMatch(/[٠-٩]/);
  });

  test('initial locale detects Hindi browser language', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'hi-IN',
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('hi');
  });

  test('setAppLocale switches to Hindi messages', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('hi');
    expect(i18n.locale).toBe('hi');
    expect(i18n.t('common.save')).not.toBe('Save');
    expect(document.documentElement.lang).toBe('hi');
    expect(localStorage.getItem('locale')).toBe('hi');
  });

  test('Hindi dates keep Latin digits', () => {
    const { setAppLocale } = loadI18n();
    const moment = require('moment');
    setAppLocale('hi');
    expect(moment.locale()).toBe('hi');
    const formatted = moment('2026-10-19T19:23:00').format('LLLL');
    expect(formatted).toContain('19');
    expect(formatted).not.toMatch(/[०-९]/);
  });

  test('every supported locale has one endonym, independent of the UI locale', () => {
    const { LANGUAGE_NAMES, SUPPORTED } = loadI18n();
    expect(Object.keys(LANGUAGE_NAMES)).toEqual(SUPPORTED);
    expect(LANGUAGE_NAMES.ar).toBe('العربية');
    expect(LANGUAGE_NAMES.ja).toBe('日本語');
    expect(LANGUAGE_NAMES['pt-BR']).toBe('Português (Brasil)');
    expect(LANGUAGE_NAMES.ur).toBe('اردو');
  });

  test('initial locale detects Japanese browser language', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'ja-JP',
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('ja');
    expect(document.documentElement.lang).toBe('ja');
    expect(document.documentElement.dir).toBe('ltr');
  });

  test('saved Japanese preference wins over the browser language', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'de-DE',
      configurable: true,
    });
    localStorage.setItem('locale', 'ja');
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('ja');
    expect(document.documentElement.lang).toBe('ja');
  });

  test('initial locale detects Indonesian browser language', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'id-ID',
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('id');
    expect(document.documentElement.lang).toBe('id');
    expect(document.documentElement.dir).toBe('ltr');
  });

  test.each(['in-ID', 'in', 'IN-id'])(
    'initial locale maps legacy %s browser language to Indonesian',
    language => {
      Object.defineProperty(navigator, 'language', {
        value: language,
        configurable: true,
      });
      const { i18n } = loadI18n();
      expect(i18n.locale).toBe('id');
      expect(document.documentElement.lang).toBe('id');
    }
  );

  test('saved Indonesian preference wins over browser language', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'de-DE',
      configurable: true,
    });
    localStorage.setItem('locale', 'id');
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('id');
    expect(document.documentElement.lang).toBe('id');
    expect(document.documentElement.dir).toBe('ltr');
  });

  test('setAppLocale switches to Japanese messages', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('ja');
    expect(i18n.locale).toBe('ja');
    expect(i18n.t('common.save')).toBe('保存');
    expect(document.documentElement.lang).toBe('ja');
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('locale')).toBe('ja');
  });

  test('switching from Arabic to Japanese restores ltr', () => {
    const { setAppLocale } = loadI18n();
    setAppLocale('ar');
    expect(document.documentElement.dir).toBe('rtl');
    setAppLocale('ja');
    expect(document.documentElement.lang).toBe('ja');
    expect(document.documentElement.dir).toBe('ltr');
  });

  test('Japanese dates use the ja Moment locale', () => {
    const { setAppLocale } = loadI18n();
    const moment = require('moment');
    setAppLocale('ja');
    expect(moment.locale()).toBe('ja');
    const formatted = moment('2026-10-19T19:23:00').format('LL');
    expect(formatted).toBe('2026年10月19日');
    expect(moment('2026-10-19T19:23:00').format('dddd')).toBe('月曜日');
  });

  test('Japanese messages keep every interpolation placeholder from English', () => {
    const en = require('~/i18n/locales/en').default;
    const ja = require('~/i18n/locales/ja').default;
    const placeholders = v => (v.match(/\{[^}]+\}/g) || []).sort();
    const walk = (a, b, path) => {
      for (const [k, v] of Object.entries(a)) {
        if (typeof v === 'string') {
          expect([path + k, placeholders(b[k] ?? '')]).toEqual([path + k, placeholders(v)]);
        } else {
          walk(v, b[k] ?? {}, path + k + '.');
        }
      }
    };
    walk(en, ja, '');
  });

  test('initial locale detects French browser language', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'fr-CA',
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('fr');
  });

  test('setAppLocale switches to French messages', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('fr');
    expect(i18n.locale).toBe('fr');
    expect(i18n.t('common.save')).not.toBe('Save');
    expect(document.documentElement.lang).toBe('fr');
    expect(localStorage.getItem('locale')).toBe('fr');
  });

  test('initial locale maps any Portuguese browser language to pt-BR', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'pt-PT',
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('pt-BR');
  });

  test('setAppLocale switches to Brazilian Portuguese messages', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('pt-BR');
    expect(i18n.locale).toBe('pt-BR');
    expect(i18n.t('common.save')).not.toBe('Save');
    expect(document.documentElement.lang).toBe('pt-BR');
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('locale')).toBe('pt-BR');
  test('Brazilian Portuguese messages keep every interpolation placeholder from English', () => {
    const en = require('~/i18n/locales/en').default;
    const ptBR = require('~/i18n/locales/pt-BR').default;
    const placeholders = v => (v.match(/\{[^}]+\}/g) || []).sort();
    const walk = (a, b, path) => {
      for (const [k, v] of Object.entries(a)) {
        if (typeof v === 'string') {
          expect([path + k, placeholders(b[k] ?? '')]).toEqual([path + k, placeholders(v)]);
        } else {
          walk(v, b[k] ?? {}, path + k + '.');
        }
      }
    };
    walk(en, ptBR, '');
  test('setAppLocale switches to Indonesian messages', () => {
    setAppLocale('id');
    expect(i18n.locale).toBe('id');
    expect(i18n.t('common.languageId')).toBe('Bahasa Indonesia');
    expect(i18n.t('common.languageAr')).toBe('العربية');
    expect(i18n.t('common.save')).toBe('Simpan');
    expect(document.documentElement.lang).toBe('id');
    expect(localStorage.getItem('locale')).toBe('id');
  test('every locale shows the Indonesian endonym', () => {
    const { i18n, setAppLocale } = loadI18n();
    for (const locale of [
      'en',
      'uk',
      'de',
      'ru',
      'zh-CN',
      'sv',
      'es',
      'ar',
      'hi',
      'ja',
      'fr',
      'id',
    ]) {
      setAppLocale(locale);
      expect(i18n.t('common.languageId')).toBe('Bahasa Indonesia');
    }
  test('switching from Arabic to Indonesian restores ltr', () => {
    const { setAppLocale } = loadI18n();
    setAppLocale('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  test('Indonesian dates use Indonesian names and Western digits', () => {
    const moment = require('moment');
    expect(moment.locale()).toBe('id');
    // 2026-10-19 is a Monday
    const formatted = moment('2026-10-19T19:23:00').format('LLLL');
    expect(formatted).toContain('Senin');
    expect(formatted).toContain('Oktober');
    expect(formatted).toContain('19');
    // switching away from Arabic must not leak its digit overrides into id
    expect(moment('2026-10-19T19:23:00').format('LLLL')).toBe(formatted);
  });

  test.each(['bn-BD', 'bn-IN', 'bn'])('initial locale detects Bengali browser language %s', tag => {
    Object.defineProperty(navigator, 'language', {
      value: tag,
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('bn');
    expect(document.documentElement.lang).toBe('bn');
    expect(document.documentElement.dir).toBe('ltr');
  });

  test('saved Bengali locale wins over browser language', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'de-DE',
      configurable: true,
    });
    localStorage.setItem('locale', 'bn');
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('bn');
  });

  test('setAppLocale switches to Bengali messages and persists', () => {
    const { setAppLocale, i18n, LANGUAGE_NAMES } = loadI18n();
    setAppLocale('bn');
    expect(i18n.locale).toBe('bn');
    expect(LANGUAGE_NAMES.bn).toBe('বাংলা');
    expect(i18n.t('common.save')).not.toBe('Save');
    expect(document.documentElement.lang).toBe('bn');
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('locale')).toBe('bn');
  });

  test('Bengali notification help preserves the literal total-time category', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('bn');
    expect(i18n.t('settings.notifications.categoryHelp')).toContain('"All"');
  });

  test('switching from Arabic to Bengali restores ltr', () => {
    const { setAppLocale } = loadI18n();
    setAppLocale('ar');
    expect(document.documentElement.dir).toBe('rtl');
    setAppLocale('bn');
    expect(document.documentElement.lang).toBe('bn');
    expect(document.documentElement.dir).toBe('ltr');
  });

  test('initial Arabic locale switches live to Bengali with ltr', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'ar-EG',
      configurable: true,
    });
    const { setAppLocale } = loadI18n();
    expect(document.documentElement.dir).toBe('rtl');
    setAppLocale('bn');
    expect(document.documentElement.dir).toBe('ltr');
  });

  test('Bengali dates use Bengali month names with Western digits', () => {
    const { setAppLocale } = loadI18n();
    const moment = require('moment');
    setAppLocale('bn');
    expect(moment.locale()).toBe('bn');
    const m = moment('2026-10-19T19:23:00');
    expect(m.format('MMMM')).toBe('অক্টোবর');
    const formatted = m.format('LLLL');
    expect(formatted).toContain('অক্টোবর');
    expect(formatted).toContain('19');
    expect(formatted).toContain('2026');
    expect(formatted).not.toMatch(/[০-৯]/);
  });

  test.each(['ur-PK', 'ur-IN', 'ur'])('initial locale detects Urdu browser language %s', lang => {
    Object.defineProperty(navigator, 'language', {
      value: lang,
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('ur');
    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');
  });

  test('initial Urdu locale comes from localStorage', () => {
    localStorage.setItem('locale', 'ur');
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('ur');
    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');
  });

  test('switching ur -> en -> ur toggles lang, dir and persists the locale', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('ur');
    expect(i18n.locale).toBe('ur');
    expect(i18n.t('common.save')).not.toBe('Save');
    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('locale')).toBe('ur');
    setAppLocale('en');
    expect(i18n.locale).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem('locale')).toBe('en');
    setAppLocale('ur');
    expect(document.documentElement.lang).toBe('ur');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('locale')).toBe('ur');
  });

  test('Urdu notification help preserves the total-time category sentinel', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('ur');
    expect(i18n.t('settings.notifications.categoryHelp')).toContain('"All"');
  });

  test('Urdu dates use Urdu month names and Western digits', () => {
    const { setAppLocale } = loadI18n();
    const moment = require('moment');
    setAppLocale('ur');
    expect(moment.locale()).toBe('ur');
    const formatted = moment('2026-10-19T19:23:00').format('LLLL');
    expect(formatted).toContain('اکتوبر');
    expect(formatted).toContain('2026');
    expect(formatted).toContain('19');
    expect(formatted).not.toMatch(/[٠-٩۰-۹]/);
  });

  test('initial locale falls back to en', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'ko-KR',
      configurable: true,
    });
    const { i18n } = loadI18n();
    expect(i18n.locale).toBe('en');
  });

  test('setAppLocale updates i18n, moment, document, and storage', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('zh-CN');
    expect(i18n.locale).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(localStorage.getItem('locale')).toBe('zh-CN');
  });

  test('setAppLocale falls back to en for invalid locale', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('not-a-locale');
    expect(i18n.locale).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('locale')).toBe('en');
  });
});
