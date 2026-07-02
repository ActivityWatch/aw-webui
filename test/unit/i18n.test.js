const originalLocalStorage = global.localStorage;

function mockLocalStorage(methods) {
  Object.defineProperty(global, 'localStorage', {
    configurable: true,
    value: {
      getItem: jest.fn(() => null),
      setItem: jest.fn(),
      ...methods,
    },
  });
}

function loadI18n() {
  jest.resetModules();
  return require('../../src/i18n');
}

afterEach(() => {
  Object.defineProperty(global, 'localStorage', {
    configurable: true,
    value: originalLocalStorage,
  });
  jest.restoreAllMocks();
});

test('defaults to English when stored locale cannot be read', () => {
  mockLocalStorage({
    getItem: jest.fn(() => {
      throw new DOMException('Blocked storage', 'SecurityError');
    }),
  });

  const { i18n } = loadI18n();

  expect(i18n.locale).toBe('en');
});

test('ignores unsupported stored locales', () => {
  mockLocalStorage({
    getItem: jest.fn(() => 'not-a-locale'),
  });

  const { i18n } = loadI18n();

  expect(i18n.locale).toBe('en');
});

test('persists supported locale changes', () => {
  mockLocalStorage();

  const { i18n, setLocale } = loadI18n();
  setLocale('zh-CN');

  expect(i18n.locale).toBe('zh-CN');
  expect(localStorage.setItem).toHaveBeenCalledWith('aw-locale', 'zh-CN');
});

test('rejects unsupported locale changes', () => {
  mockLocalStorage();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  const { i18n, setLocale } = loadI18n();
  setLocale('not-a-locale');

  expect(i18n.locale).toBe('en');
  expect(localStorage.setItem).not.toHaveBeenCalled();
  expect(console.warn).toHaveBeenCalledWith('[i18n] Unsupported locale: not-a-locale');
});

test('changes locale even when storage cannot be written', () => {
  mockLocalStorage({
    setItem: jest.fn(() => {
      throw new DOMException('Blocked storage', 'SecurityError');
    }),
  });

  const { i18n, setLocale } = loadI18n();

  expect(() => setLocale('zh-CN')).not.toThrow();
  expect(i18n.locale).toBe('zh-CN');
});
