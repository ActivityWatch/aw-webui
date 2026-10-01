// The dark stylesheet <link> is the source of truth for the theme actually
// applied to the page: App.vue manages it on startup and Theme.vue on
// setting changes. Reading the live system preference here instead could
// desync from the applied stylesheet (e.g. if the OS preference changes
// mid-session, the page keeps its startup theme).
export function isDarkThemeApplied(): boolean {
  return !!document.querySelector('head link[href="/dark.css"]');
}

export function detectPreferredTheme(): 'light' | 'dark' {
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}
