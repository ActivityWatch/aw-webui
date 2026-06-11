import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getLocale,
  installI18n,
  interpolate,
  setLocale,
  t,
  translate,
} from '~/i18n';
import Vue from 'vue';

describe('i18n', () => {
  test('uses English as the default locale', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(SUPPORTED_LOCALES).toContainEqual({
      code: 'en',
      label: 'English',
    });
  });

  test('translates English keys', () => {
    expect(t('common.loading')).toBe('Loading...');
    expect(translate('nav.activity', 'en')).toBe('Activity');
  });

  test('translates zh-CN keys', () => {
    expect(translate('common.loading', 'zh-CN')).toBe('加载中...');
    expect(translate('nav.activity', 'zh-CN')).toBe('活动');
  });

  test('falls back to English when zh-CN key is missing', () => {
    expect(translate('test.onlyEnglish', 'zh-CN')).toBe('Only English');
  });

  test('returns the key when no locale contains the key', () => {
    expect(translate('missing.key', 'zh-CN')).toBe('missing.key');
  });

  test('interpolates named params', () => {
    expect(translate('activity.hostLabel', 'en', { host: 'laptop' })).toBe('Host: laptop');
    expect(translate('activity.hostLabel', 'zh-CN', { host: 'laptop' })).toBe('主机：laptop');
  });

  test('t follows the active locale', () => {
    setLocale('zh-CN');
    expect(t('nav.activity')).toBe('活动');
    setLocale('en');
    expect(t('nav.activity')).toBe('Activity');
  });

  test('falls back to the default locale for invalid locale input', () => {
    setLocale('zh-CN');

    setLocale('fr-FR');
    expect(getLocale()).toBe(DEFAULT_LOCALE);
    expect(t('nav.activity')).toBe('Activity');

    setLocale('zh-CN');
    setLocale(null);
    expect(getLocale()).toBe(DEFAULT_LOCALE);

    setLocale('zh-CN');
    setLocale(undefined);
    expect(getLocale()).toBe(DEFAULT_LOCALE);
  });

  test('installs $t on Vue without requiring a Vue argument', () => {
    delete Vue.prototype.$t;

    installI18n();

    expect(Vue.prototype.$t('nav.activity')).toBe('Activity');
  });

  test('keeps placeholders for missing params', () => {
    expect(interpolate('Found {count} events in {seconds} seconds', { count: 5 })).toBe(
      'Found 5 events in {seconds} seconds'
    );
  });
});
