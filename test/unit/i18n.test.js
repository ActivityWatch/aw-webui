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
    expect(isAppLocale('fr')).toBe(false);
    expect(isAppLocale('')).toBe(false);
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
    setAppLocale('ru');
    expect(i18n.locale).toBe('ru');
    expect(document.documentElement.lang).toBe('ru');
    expect(localStorage.getItem('locale')).toBe('ru');
  });

  test('setAppLocale falls back to en for invalid locale', () => {
    const { setAppLocale, i18n } = loadI18n();
    setAppLocale('not-a-locale');
    expect(i18n.locale).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('locale')).toBe('en');
  });
});
