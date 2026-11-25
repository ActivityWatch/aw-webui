import {
  format_day_of_month,
  format_weekday_short,
  friendlydate,
  get_short_month_labels,
  seconds_to_duration,
} from '~/util/time';
import moment from 'moment';
import { i18n } from '~/i18n';

describe('seconds_to_duration', () => {
  test('should format 8145 seconds as "2h 15m 45s"', () => {
    expect(seconds_to_duration(8145)).toBe('2h 15m 45s');
  });

  test('should format 3630 seconds as "1h 0m 30s"', () => {
    expect(seconds_to_duration(3630)).toBe('1h 0m 30s');
  });

  test('should format 3600 seconds as "1h 0m 0s"', () => {
    expect(seconds_to_duration(3600)).toBe('1h 0m 0s');
  });

  test('should format 1830 seconds as "30m 30s"', () => {
    expect(seconds_to_duration(1830)).toBe('30m 30s');
  });

  test('should format 60 seconds as "1m 0s"', () => {
    expect(seconds_to_duration(60)).toBe('1m 0s');
  });

  test('should format 30 seconds as "30s"', () => {
    expect(seconds_to_duration(30)).toBe('30s');
  });
});

// Node builds without full ICU data silently fall back to the default locale
// for any non-English locale, which breaks cross-locale assertions. This is
// common in distro-packaged Node (Debian, Fedora, Arch). Detect it so we can
// skip the cross-locale comparisons in those environments. See issue #871.
function hasLocale(locale) {
  try {
    return new Intl.DateTimeFormat(locale).resolvedOptions().locale === locale;
  } catch (_) {
    return false;
  }
}

const HAS_SV_SE = hasLocale('sv-SE');

describe('locale-aware time labels', () => {
  test('should format weekday labels using the supplied locale', () => {
    const monday = new Date(2026, 4, 18, 12);

    expect(format_weekday_short(monday, 'en-US')).toBe(
      new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(monday)
    );
    expect(format_weekday_short(monday, 'sv-SE')).toBe(
      new Intl.DateTimeFormat('sv-SE', { weekday: 'short' }).format(monday)
    );
    if (HAS_SV_SE) {
      expect(format_weekday_short(monday, 'sv-SE')).not.toBe(format_weekday_short(monday, 'en-US'));
    }
  });

  test('should format month-day labels without hardcoded english ordinals', () => {
    expect(format_day_of_month(new Date(2026, 4, 1, 12), 'en-US')).toBe('1');
  });

  test('should format short month labels using the supplied locale', () => {
    const enUSMonths = get_short_month_labels('en-US');
    const svSEMonths = get_short_month_labels('sv-SE');

    expect(enUSMonths).toEqual(
      Array.from({ length: 12 }, (_, month) =>
        new Intl.DateTimeFormat('en-US', { month: 'short' }).format(new Date(2020, month, 1, 12))
      )
    );
    expect(svSEMonths).toEqual(
      Array.from({ length: 12 }, (_, month) =>
        new Intl.DateTimeFormat('sv-SE', { month: 'short' }).format(new Date(2020, month, 1, 12))
      )
    );
    if (HAS_SV_SE) {
      expect(svSEMonths).not.toEqual(enUSMonths);
    }
  });
});

describe('friendlydate', () => {
  let previousLocale: string;
  let previousAppLocale: string;

  beforeEach(() => {
    previousLocale = moment.locale();
    previousAppLocale = i18n.locale;
    jest.useFakeTimers().setSystemTime(new Date('2026-11-24T12:00:00Z'));
  });

  afterEach(() => {
    moment.locale(previousLocale);
    i18n.locale = previousAppLocale;
    jest.useRealTimers();
  });

  test('uses the app locale even after Timeline changes the Moment locale (#1324)', () => {
    i18n.locale = 'de';
    moment.locale('en');
    if (Intl.RelativeTimeFormat.supportedLocalesOf(['de']).length) {
      expect(friendlydate(moment().subtract(30, 'seconds'))).toBe('vor 30 Sekunden');
    }
    expect(friendlydate(moment().subtract(2, 'minutes'))).toBe('vor 2 Minuten');
    expect(moment.locale()).toBe('en');
  });

  test.each([
    [0, '0 seconds ago'],
    [1, '1 second ago'],
    [2, '2 seconds ago'],
    [30, '30 seconds ago'],
    [59, '59 seconds ago'],
    [60, '60 seconds ago'],
  ])('keeps a seconds count in English at %i seconds', (seconds, expected) => {
    i18n.locale = 'en';
    moment.locale('de');
    expect(friendlydate(moment().subtract(seconds, 'seconds'))).toBe(expected);
  });

  test.each([
    ['de', 'vor 1 Sekunde'],
    ['pt-BR', 'há 1 segundo'],
    ['zh-CN', '1秒钟前'],
    ['bn', '1 সেকেন্ড আগে'],
  ])('handles one second in %s', (locale, expected) => {
    i18n.locale = locale;
    moment.locale('en');
    // Like the date-label tests above, allow Node builds without full ICU data.
    if (Intl.RelativeTimeFormat.supportedLocalesOf([locale]).length) {
      expect(friendlydate(moment().subtract(1, 'second'))).toBe(expected);
    }
  });
});
