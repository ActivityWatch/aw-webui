import {
  format_day_of_month,
  format_weekday_short,
  get_short_month_labels,
  seconds_to_duration,
} from '~/util/time';

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
