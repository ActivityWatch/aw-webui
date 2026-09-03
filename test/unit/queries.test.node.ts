/**
 * Tests for browser app name regex patterns in queries.ts.
 *
 * The patterns in browser_appname_regex replaced exhaustive exact-match lists that were
 * previously hardcoded in browser_appnames. Every app name that was in the old lists is
 * tested here as a regression guard. If a real-world app name is discovered that doesn't
 * match, add it to the relevant test below AND update the regex pattern in queries.ts.
 *
 * Historical exact-match lists (pre-regex):
 *
 *   Chrome:   'Google Chrome', 'Google-chrome', 'Chrome.exe', 'chrome.exe',
 *             'google-chrome-stable', 'Chromium', 'Chromium-browser', 'chromium-browser',
 *             'Chromium-browser-chromium', 'Chromium.exe', 'chromium.exe',
 *             'Google-chrome-beta', 'Google-chrome-unstable'
 *             (Flatpak app IDs retained as exact: 'com.google.Chrome', 'com.google.ChromeDev',
 *              'org.chromium.Chromium')
 *
 *   Firefox:  'Firefox', 'Firefox.exe', 'firefox', 'firefox.exe',
 *             'Firefox Developer Edition', 'firefoxdeveloperedition',
 *             'Firefox-esr', 'Firefox Beta', 'Nightly', 'firefox-aurora', 'firefox-trunk-dev',
 *             'LibreWolf-Portable.exe', 'LibreWolf', 'LibreWolf.exe', 'Librewolf', 'Librewolf.exe',
 *             'librewolf', 'librewolf.exe', 'librewolf-default',
 *             'Waterfox', 'Waterfox.exe', 'waterfox', 'waterfox.exe'
 *             (Flatpak app IDs retained as exact: 'org.mozilla.firefox',
 *              'io.gitlab.librewolf-community', 'net.waterfox.waterfox')
 *
 *   Opera:    'opera.exe', 'Opera.exe', 'Opera'
 *             (Flatpak app ID retained: 'com.opera.Opera')
 *
 *   Brave:    'Brave-browser', 'brave-browser', 'Brave Browser', 'brave.exe', 'Brave.exe'
 *             (Flatpak app ID retained: 'com.brave.Browser')
 *
 *   Edge:     'msedge.exe', 'Microsoft Edge', 'Microsoft Edge Beta',
 *             'Microsoft-Edge-Stable', 'Microsoft-edge', 'microsoft-edge',
 *             'microsoft-edge-beta', 'microsoft-edge-dev'
 *             (Flatpak app IDs retained: 'com.microsoft.Edge', 'com.microsoft.EdgeDev')
 *
 *   Arc:      'arc.exe', 'Arc.exe', 'Arc'
 *             (also matched by the chrome pattern, since Arc reports to the chrome bucket
 *              unless the browser name is overridden in the extension settings)
 *
 *   Vivaldi:  'Vivaldi-stable', 'Vivaldi-snapshot', 'vivaldi.exe', 'Vivaldi.exe', 'Vivaldi'
 *             (Flatpak app ID retained: 'com.vivaldi.Vivaldi')
 *
 *   Orion:    'Orion'
 *
 *   Yandex:   'Yandex'
 *             (Flatpak app ID retained: 'ru.yandex.Browser')
 *
 *   Zen:      'Zen', 'Zen Browser', 'Zen-browser', 'zen', 'zen browser', 'zen-browser',
 *             'zen.exe', 'Zen.exe'
 *             (Flatpak app ID retained: 'app.zen_browser.zen')
 *
 *   Floorp:   'Floorp', 'floorp.exe', 'Floorp.exe', 'floorp'
 *             (Flatpak app ID retained: 'one.ablaze.floorp')
 */

import {
  browser_appname_regex,
  appQuery,
  categoryQuery,
  querystr_to_array,
  canonicalEvents,
} from '~/queries';

// Convert ActivityWatch (?i) patterns to JS RegExp with i flag for testing.
// AW server uses Python-style (?i) inline flag; JS uses RegExp 'i' flag instead.
function toRegex(pattern: string): RegExp {
  const stripped = pattern.replace(/^\(\?i\)/, '');
  return new RegExp(stripped, 'i');
}

describe('browser_appname_regex', () => {
  test('chrome pattern matches all known Chrome/Chromium app names', () => {
    const re = toRegex(browser_appname_regex.chrome);
    // Every entry from the old exact-match list
    const knownNames = [
      'Google Chrome',
      'Google-chrome',
      'Chrome.exe',
      'chrome.exe',
      'google-chrome-stable',
      'Google_Chrome',
      'Chromium',
      'Chromium-browser',
      'chromium-browser',
      'Chromium-browser-chromium',
      'Chromium.exe',
      'chromium.exe',
      'Google-chrome-beta',
      'Google-chrome-unstable',
      // Chromium forks that report through the chrome extension bucket (#927)
      'Arc',
      'arc.exe',
      'Arc.exe',
      'Dia',
      'Dia.exe',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('chrome pattern does not false-positive', () => {
    const re = toRegex(browser_appname_regex.chrome);
    // Flatpak app IDs are in the exact list, not matched by regex
    expect(re.test('com.google.Chrome')).toBe(false);
    expect(re.test('Slack')).toBe(false);
    expect(re.test('Electron')).toBe(false);
    // The fork alternatives are anchored, so names merely starting with them don't match
    expect(re.test('archive')).toBe(false);
    expect(re.test('arcade')).toBe(false);
    expect(re.test('Dialog')).toBe(false);
  });

  test('firefox pattern matches all known Firefox/LibreWolf/Waterfox app names', () => {
    const re = toRegex(browser_appname_regex.firefox);
    // Every entry from the old exact-match list
    const knownNames = [
      'Firefox',
      'Firefox.exe',
      'firefox',
      'firefox.exe',
      'Firefox Developer Edition',
      'firefoxdeveloperedition',
      'Firefox-esr',
      'firefox-esr-esr140', // versioned ESR (issue #749)
      'Firefox Beta',
      'Nightly',
      'firefox-aurora',
      'firefox-trunk-dev',
      'LibreWolf-Portable.exe',
      'LibreWolf',
      'LibreWolf.exe',
      'Librewolf',
      'Librewolf.exe',
      'librewolf',
      'librewolf.exe',
      'librewolf-default',
      'Waterfox',
      'Waterfox.exe',
      'waterfox',
      'waterfox.exe',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('opera pattern matches all known Opera app names', () => {
    const re = toRegex(browser_appname_regex.opera);
    const knownNames = ['opera.exe', 'Opera.exe', 'Opera'];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('brave pattern matches all known Brave app names', () => {
    const re = toRegex(browser_appname_regex.brave);
    const knownNames = [
      'Brave-browser',
      'brave-browser',
      'Brave Browser',
      'brave.exe',
      'Brave.exe',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('edge pattern matches all known Edge app names', () => {
    const re = toRegex(browser_appname_regex.edge);
    const knownNames = [
      'msedge.exe',
      'Microsoft Edge',
      'Microsoft Edge Beta',
      'Microsoft-Edge-Stable',
      'Microsoft-edge',
      'microsoft-edge',
      'microsoft-edge-beta',
      'microsoft-edge-dev',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('arc pattern matches known Arc names but not arc-prefixed words', () => {
    const re = toRegex(browser_appname_regex.arc);
    // Known app names
    expect(re.test('Arc')).toBe(true);
    expect(re.test('arc.exe')).toBe(true);
    expect(re.test('Arc.exe')).toBe(true);
    // Must NOT match names that merely contain "arc"
    expect(re.test('archive')).toBe(false);
    expect(re.test('arcade')).toBe(false);
    expect(re.test('ReactNativeArcApp')).toBe(false);
  });

  test('vivaldi pattern matches all known Vivaldi app names', () => {
    const re = toRegex(browser_appname_regex.vivaldi);
    const knownNames = [
      'Vivaldi-stable',
      'Vivaldi-snapshot',
      'vivaldi.exe',
      'Vivaldi.exe',
      'Vivaldi',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('orion pattern matches known Orion app names', () => {
    const re = toRegex(browser_appname_regex.orion);
    expect(re.test('Orion')).toBe(true);
    expect(re.test('orion')).toBe(true);
  });

  test('yandex pattern matches known Yandex app names', () => {
    const re = toRegex(browser_appname_regex.yandex);
    expect(re.test('Yandex')).toBe(true);
    expect(re.test('yandex')).toBe(true);
  });

  test('zen pattern matches all known Zen Browser app names', () => {
    const re = toRegex(browser_appname_regex.zen);
    const knownNames = [
      'Zen',
      'Zen Browser',
      'Zen-browser',
      'zen',
      'zen browser',
      'zen-browser',
      'zen.exe',
      'Zen.exe',
    ];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('floorp pattern matches all known Floorp app names', () => {
    const re = toRegex(browser_appname_regex.floorp);
    const knownNames = ['Floorp', 'floorp.exe', 'Floorp.exe', 'floorp'];
    for (const name of knownNames) {
      expect(re.test(name)).toBe(true);
    }
  });

  test('safari pattern matches known Safari app names', () => {
    const re = toRegex(browser_appname_regex.safari);
    expect(re.test('Safari')).toBe(true);
    expect(re.test('safari')).toBe(true);
    expect(re.test('Safari浏览器')).toBe(true); // macOS Chinese localization
    // Should not match unrelated apps
    expect(re.test('SafariBrowser')).toBe(false);
  });
});

describe('querystr_to_array', () => {
  test('splits simple multi-statement query correctly', () => {
    const query = 'events = query_bucket("aw-watcher-window_host"); RETURN = {"events": events};';
    const result = querystr_to_array(query);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('events = query_bucket("aw-watcher-window_host");');
    expect(result[1]).toBe('RETURN = {"events": events};');
  });

  test('does not split on semicolons inside string literals (category regex case)', () => {
    // A category rule with a semicolon in the regex — the naive .split(';') would shred this.
    const query = 'events = categorize(events, [["Work", {"type": "regex", "regex": "foo;bar"}]]);';
    const result = querystr_to_array(query);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(
      'events = categorize(events, [["Work", {"type": "regex", "regex": "foo;bar"}]]);'
    );
  });

  test('handles escaped double-quotes inside string literals', () => {
    const query = 'x = "say \\"hello;world\\""; RETURN = x;';
    const result = querystr_to_array(query);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('x = "say \\"hello;world\\"";');
    expect(result[1]).toBe('RETURN = x;');
  });

  test('filters out empty statements from whitespace-only segments', () => {
    const query = '\n  events = query_bucket("bucket");\n  RETURN = events;\n';
    const result = querystr_to_array(query);
    expect(result).toHaveLength(2);
  });
});

// Regression guard for ActivityWatch/aw-webui#959:
// aw-watcher-android events carry "app"/"package"/"classname" but NOT "title".
// merge_events_by_keys skips events missing any requested key, so including
// "title" in the Android (non-iOS) path collapsed all activity to 0s.
describe('appQuery merge key regression', () => {
  const categories: any[] = [];
  const filter_categories: string[][] = [];

  test('Android watcher path does NOT merge on "title"', () => {
    const q = appQuery('aw-watcher-android_device', categories, filter_categories, false);
    const joined = q.join('\n');
    // The canonical-events step must not reference "title" for the non-iOS path
    expect(joined).not.toContain('merge_events_by_keys(events, ["app", "title"])');
    // The title_events step must merge on "classname" but not "title"
    expect(joined).toContain('"app", "classname"');
    expect(joined).not.toContain('"app", "classname", "title"');
  });

  test('iOS ScreenTime path DOES merge on "title"', () => {
    const q = appQuery('aw-import-screentime_device', categories, filter_categories, true);
    const joined = q.join('\n');
    // The canonical-events step must reference "title" for the iOS path
    expect(joined).toContain('merge_events_by_keys(events, ["app", "title"])');
    // The title_events step must merge on "title" for iOS
    expect(joined).toContain('"app", "classname", "title"');
  });
});

// Regression guard for the category/Category-Builder ScreenTime caller paths:
// query_category_time_by_period and CategoryBuilder.vue both call categoryQuery/
// canonicalEvents with bid_android.  They were missing isIos, causing ScreenTime
// buckets to lose title distinctions before category assignment.
describe('categoryQuery merge key regression (ScreenTime callers)', () => {
  const categories: any[] = [];
  const filter_categories: string[][] = [];

  test('Android watcher bucket does NOT merge on "title" in category query', () => {
    const q = categoryQuery({
      bid_android: 'aw-watcher-android_device',
      categories,
      filter_categories,
      filter_afk: false,
    });
    const joined = q.join('\n');
    expect(joined).not.toContain('merge_events_by_keys(events, ["app", "title"])');
  });

  test('iOS ScreenTime bucket DOES merge on "title" in category query when isIos=true', () => {
    const q = categoryQuery({
      bid_android: 'aw-import-screentime_device',
      isIos: true,
      categories,
      filter_categories,
      filter_afk: false,
    });
    const joined = q.join('\n');
    expect(joined).toContain('merge_events_by_keys(events, ["app", "title"])');
  });
});

test('canonicalEvents serializes select_keys into categorize()', () => {
  const query = canonicalEvents({
    bid_android: 'aw-watcher-android_test',
    categories: [[['Work'], { type: 'regex', regex: 'Firefox', select_keys: ['app'] }]],
    filter_categories: [],
  });
  expect(query).toContain('"select_keys":["app"]');
  expect(query).toContain('"regex":"Firefox"');
});
