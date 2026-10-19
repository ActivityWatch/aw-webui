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
    expect(isAppLocale('fr')).toBe(false);
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
    expect(i18n.t('common.languageEs')).toBe('Español');
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
    expect(i18n.t('common.languageAr')).toBe('العربية');
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

  test('initial locale falls back to en', () => {
    Object.defineProperty(navigator, 'language', {
      value: 'fr-FR',
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
