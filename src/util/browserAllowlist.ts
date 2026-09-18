/**
 * Detect the silent-empty Browser view: a browser watcher bucket exists, the
 * query finished, and the window-event intersection came back empty.
 *
 * This is the Chromium-fork failure mode (aw-webui#927): events land in
 * `aw-watcher-web-chrome_*` but `app` is "Dia"/"Arc"/… and matches nothing.
 * It is also the honest "didn't browse this period" case, so the UI copy
 * must cover both.
 *
 * `top_domains === null` means the query is still in flight (see
 * `start_loading` in the activity store) and must not fire the hint.
 */
export function isBrowserAllowlistMiss(browser: {
  available: boolean;
  duration: number;
  top_domains: unknown[] | null;
}): boolean {
  if (!browser.available) return false;
  if (browser.top_domains === null) return false;
  return browser.duration === 0 && browser.top_domains.length === 0;
}
