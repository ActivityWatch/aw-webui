import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getLocale,
  installI18n,
  interpolate,
  setLocale,
  t,
  TranslationParams,
  translate,
} from '~/i18n';
import en from '~/i18n/locales/en';
import zhCN from '~/i18n/locales/zh-CN';
import Vue from 'vue';

type LocaleValue = string | LocaleTree;
type LocaleTree = {
  [key: string]: LocaleValue;
};

function findExtraLocaleKeys(canonical: LocaleTree, candidate: LocaleTree, prefix = ''): string[] {
  return Object.keys(candidate).flatMap(key => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (!Object.prototype.hasOwnProperty.call(canonical, key)) {
      return [path];
    }

    const canonicalValue = canonical[key];
    const candidateValue = candidate[key];

    if (typeof canonicalValue === 'string') {
      return typeof candidateValue === 'string' ? [] : [path];
    }

    return typeof candidateValue === 'string'
      ? []
      : findExtraLocaleKeys(canonicalValue, candidateValue, path);
  });
}

describe('i18n', () => {
  const originalVueT = Vue.prototype.$t;

  beforeEach(() => {
    setLocale(DEFAULT_LOCALE);
  });

  afterEach(() => {
    setLocale(DEFAULT_LOCALE);

    if (originalVueT === undefined) {
      delete Vue.prototype.$t;
    } else {
      Vue.prototype.$t = originalVueT;
    }
  });

  test('uses English as the default locale', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(SUPPORTED_LOCALES).toContainEqual({
      code: 'en',
      label: 'English',
    });
  });

  test('exposes supported locales as an immutable iterable list', () => {
    expect(Array.from(SUPPORTED_LOCALES)).toEqual(
      expect.arrayContaining([
        { code: 'en', label: 'English' },
        { code: 'zh-CN', label: '简体中文' },
      ])
    );
    expect(Object.isFrozen(SUPPORTED_LOCALES)).toBe(true);
    expect(SUPPORTED_LOCALES.every(locale => Object.isFrozen(locale))).toBe(true);
    expect(() => {
      (SUPPORTED_LOCALES as unknown as Array<{ code: string; label: string }>).push({
        code: 'fr-FR',
        label: 'French',
      });
    }).toThrow();
  });

  test.each([['zh-CN', zhCN]])('%s does not define keys outside the English schema', (_, locale) => {
    expect(findExtraLocaleKeys(en, locale)).toEqual([]);
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

  test('updates Vue instance translations when the active locale changes', async () => {
    installI18n();

    const vm = new Vue({
      computed: {
        activityLabel(this: Vue & { $t: typeof t }) {
          return this.$t('nav.activity');
        },
      },
    }) as Vue & { activityLabel: string };

    expect(vm.activityLabel).toBe('Activity');

    setLocale('zh-CN');
    await Vue.nextTick();

    expect(vm.activityLabel).toBe('活动');

    vm.$destroy();
  });

  test('keeps placeholders for missing params', () => {
    expect(interpolate('Found {count} events in {seconds} seconds', { count: 5 })).toBe(
      'Found 5 events in {seconds} seconds'
    );
  });

  test('keeps placeholders for inherited or nullish params', () => {
    const inheritedParams = Object.create({ name: 'inherited' }) as TranslationParams;
    const explicitParams = Object.create(null) as TranslationParams;
    explicitParams['constructor'] = 'explicit';

    expect(interpolate('Missing {constructor}', {})).toBe('Missing {constructor}');
    expect(interpolate('Missing {name}', inheritedParams)).toBe('Missing {name}');
    expect(interpolate('Missing {name}', { name: null })).toBe('Missing {name}');
    expect(interpolate('Found {constructor}', explicitParams)).toBe('Found explicit');
  });
});
