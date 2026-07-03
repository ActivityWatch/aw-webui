describe('i18n', () => {
  const loadI18n = () => {
    jest.resetModules();
    return require('~/i18n');
  };

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('lang');
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
