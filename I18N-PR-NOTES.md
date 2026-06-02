# i18n changes — notes for review / PR

## Scope (aw-webui only)

This contribution adds internationalization via `vue-i18n@8` (Vue 2).

### New files
- `src/i18n/index.ts` — locale detection, `setAppLocale`, HTML `lang`
- `src/i18n/locales/en.ts` — English (source strings)
- `src/i18n/locales/uk.ts`, `de.ts`, `ru.ts` — translations
- `src/views/settings/LanguageSettings.vue` — language picker

### Modified (wire `$t()`)
- `src/main.js` — register i18n
- `src/App.vue` — apply saved locale after settings load
- `src/stores/settings.ts` — persist `locale` in settings
- `src/components/Header.vue`, `Footer.vue`
- Main views: Home, Buckets, Activity, Timeline, Search, Query, Report, etc.
- Settings sub-pages

### Dependencies
- `package.json`: `vue-i18n@^8.28.2`
- `package-lock.json`: lockfile update (includes some npm `peer` metadata flags — harmless)

## Out of scope (do not include in aw-webui PR)

| Path | Reason |
|------|--------|
| `../../DEV-SETUP.md` | Local Windows dev notes (parent `activitywatch` repo) |
| `../../scripts/local-build.sh` | Local build helper |
| `aw-server-rust/Cargo.lock` | Accidental build drift — reverted |

## Suggested PR target

Submit to **https://github.com/ActivityWatch/aw-webui** (not the meta `activitywatch` bundle), then bump submodule in `aw-server` after merge.

## Suggested commit message

```
feat(i18n): add Ukrainian, German, and Russian UI translations

Introduce vue-i18n with en/uk/de/ru locale files, a language
setting, and translated strings for navigation, settings, and
main views. Browser language is detected on first visit; choice
is persisted in settings and localStorage.
```

## Fork-only customization

To default to Ukrainian in a private fork, set in `src/i18n/index.ts`:
`detectBrowserLocale() ?? 'uk'` and `locale: 'uk'` in `settings.ts` state.

## Pre-submit checklist

- [ ] `npm run build` in `aw-webui`
- [ ] `npm run lint` (if used)
- [ ] Manual: switch all 4 languages in Settings
- [ ] No unrelated formatting-only churn in untouched files
- [ ] PR description lists incomplete areas (Category Builder, modals, dev-only views)

## Known gaps (follow-up PRs)

- Category Builder, Alerts, Graph, Dev views — still English
- `prompt()` / `confirm()` in categorization — not i18n
- Default category names in `classes.ts` — data, not UI
- `vue-i18n@8` is legacy (Vue 2); migration to Vue 3 / intlify is separate
