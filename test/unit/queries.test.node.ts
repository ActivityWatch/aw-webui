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

import { browser_appname_regex, canonicalEvents } from '~/queries';

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
});

describe('canonicalEvents editor bucket support', () => {
  const baseParams = {
    bid_window: 'aw-watcher-window_host',
    bid_afk: 'aw-watcher-afk_host',
    filter_afk: true,
    categories: [],
    filter_categories: [],
  };

  test('includes editor bucket queries when bid_editors is set', () => {
    const query = canonicalEvents({
      ...baseParams,
      bid_editors: ['aw-watcher-vim_host'],
    });
    expect(query).toContain('editor_events');
    expect(query).toContain('aw-watcher-vim_host');
    expect(query).toContain('filter_period_intersect');
    // flood() is required so category rules fire for full editing sessions,
    // not just brief heartbeat windows
    expect(query).toContain('flood(query_bucket("aw-watcher-vim_host"))');
  });

  test('includes multiple editor buckets when bid_editors has multiple entries', () => {
    const query = canonicalEvents({
      ...baseParams,
      bid_editors: ['aw-watcher-vim_host', 'aw-watcher-vscode_host'],
    });
    expect(query).toContain('aw-watcher-vim_host');
    expect(query).toContain('aw-watcher-vscode_host');
  });

  test('does not include editor query when bid_editors is absent', () => {
    const query = canonicalEvents(baseParams);
    expect(query).not.toContain('editor_events');
  });

  test('does not include editor query when bid_editors is empty', () => {
    const query = canonicalEvents({ ...baseParams, bid_editors: [] });
    expect(query).not.toContain('editor_events');
  });

  test('editor events are added before categorize', () => {
    const query = canonicalEvents({
      ...baseParams,
      categories: [[['Development'], { type: 'regex', regex: 'myproject' }]],
      bid_editors: ['aw-watcher-vim_host'],
    });
    const editorPos = query.indexOf('editor_events');
    const categorizePos = query.indexOf('categorize');
    expect(editorPos).toBeGreaterThan(-1);
    expect(categorizePos).toBeGreaterThan(-1);
    expect(editorPos).toBeLessThan(categorizePos);
  });

  test('window_events is saved before editor concat to preserve app/title breakdown', () => {
    // canonicalEvents must emit "window_events = events" BEFORE the concat so that
    // fullDesktopQuery can use window_events for app/title aggregation without
    // including editor events (which lack "app"/"title" and would create a null-app bucket).
    const query = canonicalEvents({
      ...baseParams,
      bid_editors: ['aw-watcher-vim_host'],
    });
    const windowSavePos = query.indexOf('window_events = events');
    const concatPos = query.indexOf('concat(window_events, editor_events)');
    expect(windowSavePos).toBeGreaterThan(-1);
    expect(concatPos).toBeGreaterThan(-1);
    expect(windowSavePos).toBeLessThan(concatPos);
  });

  test('window_events is NOT emitted when bid_editors is absent', () => {
    const query = canonicalEvents(baseParams);
    expect(query).not.toContain('window_events');
  });
});

import { fullDesktopQuery } from '~/queries';

describe('fullDesktopQuery editor bucket regression', () => {
  const baseDesktopParams = {
    bid_window: 'aw-watcher-window_host',
    bid_afk: 'aw-watcher-afk_host',
    filter_afk: true,
    categories: [],
    filter_categories: [],
  };

  test('uses window_events for app/title aggregation when bid_editors is set', () => {
    const query = fullDesktopQuery({
      ...baseDesktopParams,
      bid_editors: ['aw-watcher-vim_host'],
    }).join('\n');
    // app/title aggregation must use window_events, not events, to avoid null-app bucket
    expect(query).toContain('merge_events_by_keys(window_events, ["app", "title"])');
    expect(query).toContain('sum_durations(window_events)');
    // cat_events must still use the full events (with editor events) for category breakdown
    expect(query).toContain('merge_events_by_keys(events, ["$category"])');
  });

  test('uses events directly for app/title aggregation when no bid_editors', () => {
    const query = fullDesktopQuery(baseDesktopParams).join('\n');
    expect(query).toContain('merge_events_by_keys(events, ["app", "title"])');
    expect(query).toContain('sum_durations(events)');
    expect(query).not.toContain('window_events');
  });

  test('re-intersects window_events with filtered events when editor buckets + category filter active', () => {
    // When bid_editors + filter_categories are both set, window_events must be
    // re-intersected with the post-filter events stream so duration/app/title
    // aggregations respect the active category filter (Greptile 4/5 finding).
    const query = fullDesktopQuery({
      ...baseDesktopParams,
      bid_editors: ['aw-watcher-vim_host'],
      filter_categories: [['Work']],
    }).join('\n');
    const filterPos = query.indexOf('filter_keyvals(events, "$category"');
    const reIntersectPos = query.indexOf('filter_period_intersect(window_events, events)');
    expect(reIntersectPos).toBeGreaterThan(-1);
    // re-intersect must happen AFTER filter_keyvals so it uses the filtered stream
    expect(reIntersectPos).toBeGreaterThan(filterPos);
  });

  test('does NOT re-intersect window_events when no category filter active', () => {
    // Without a non-empty category filter, window_events from before the editor concat
    // is already correct — no need to re-intersect.
    // baseDesktopParams has filter_categories: [] (empty = no active filter).
    const query = fullDesktopQuery({
      ...baseDesktopParams,
      bid_editors: ['aw-watcher-vim_host'],
      filter_categories: [],
    }).join('\n');
    // window_events = events save-point is present (for null-app protection)
    expect(query).toContain('window_events = events');
    // but no re-intersection since filter_categories is empty
    expect(query).not.toContain('filter_period_intersect(window_events, events)');
  });
});
