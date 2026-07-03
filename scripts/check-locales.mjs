#!/usr/bin/env node
/**
 * Validates i18n locale files: key parity vs en, placeholder consistency, untranslated strings.
 * Usage: node scripts/check-locales.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '../src/i18n/locales');
const LOCALES = ['en', 'uk', 'de', 'ru', 'zh-CN'];

/** Substrings: identical en/value is OK when value contains any of these (case-insensitive). */
const ALLOWLIST_SUBSTRINGS = [
  'activitywatch',
  'discord',
  'github',
  'twitter',
  'facebook',
  'patreon',
  'reddit',
  'producthunt',
  'alternativeto',
  'opentelemetry',
  'json',
  'csv',
  'api',
  'host',
  'bucket',
  'watcher',
  'afk',
  'stopwatch',
  'timespiral',
  'devtools',
  'devmode',
  'hostname',
  'http',
  'forum',
  'liberapay',
  'opencollective',
  'mozilla',
  'chrome',
  'android',
  'ios',
  'linux',
  'windows',
  'macos',
  'npm',
  'vue',
  'pinia',
  'id',
  'url',
  'regex',
  'score',
  'timeline',
  'graph',
  'query',
  'trends',
  'report',
  'search',
  'settings',
  'home',
  'tools',
  'theme',
  'auto',
  'light',
  'dark',
  'monday',
  'saturday',
  'sunday',
  'version',
  'experiment',
  'wip',
  'demo',
  'cancel',
  'save',
  'open',
  'more',
  'delete',
  'import',
  'export',
  'confirm',
  'enabled',
  'disabled',
  'loading',
  'refresh',
  'options',
  'filters',
  'remove',
  'start',
  'end',
  'running',
  'history',
  'documentation',
  'website',
];

function loadLocale(code) {
  const filePath = path.join(LOCALES_DIR, `${code}.ts`);
  let text = fs.readFileSync(filePath, 'utf8');
  text = text.replace(/export\s+default\s+/, '').replace(/;\s*$/, '');
  // Locale files are static object literals only.
  // eslint-disable-next-line no-new-func
  return new Function(`return (${text})`)();
}

function flatten(obj, prefix = '') {
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value, pathKey));
    } else if (typeof value === 'string') {
      out[pathKey] = value;
    }
  }
  return out;
}

function placeholders(s) {
  const m = s.match(/\{[a-zA-Z]+\}/g);
  return m ? [...new Set(m)].sort().join(',') : '';
}

function isAllowlistedIdentical(enValue, targetValue) {
  if (enValue !== targetValue) return false;
  const lower = enValue.toLowerCase();
  if (enValue.length <= 3) return true;
  return ALLOWLIST_SUBSTRINGS.some(sub => lower.includes(sub));
}

let failed = false;

const enFlat = flatten(loadLocale('en'));

for (const code of LOCALES) {
  if (code === 'en') continue;
  const flat = flatten(loadLocale(code));
  const enKeys = new Set(Object.keys(enFlat));
  const keys = new Set(Object.keys(flat));

  const missing = [...enKeys].filter(k => !keys.has(k));
  const extra = [...keys].filter(k => !enKeys.has(k));

  if (missing.length) {
    failed = true;
    console.error(`\n[${code}] Missing keys (${missing.length}):`);
    missing.slice(0, 20).forEach(k => console.error(`  - ${k}`));
    if (missing.length > 20) console.error(`  ... and ${missing.length - 20} more`);
  }
  if (extra.length) {
    failed = true;
    console.error(`\n[${code}] Extra keys (${extra.length}):`);
    extra.slice(0, 20).forEach(k => console.error(`  - ${k}`));
  }

  const placeholderMismatches = [];
  const untranslated = [];

  for (const key of enKeys) {
    if (!keys.has(key)) continue;
    const enVal = enFlat[key];
    const val = flat[key];
    if (placeholders(enVal) !== placeholders(val)) {
      placeholderMismatches.push({ key, en: placeholders(enVal), got: placeholders(val) });
    }
    if (key.startsWith('common.language')) continue;
    if (enVal === val && !isAllowlistedIdentical(enVal, val)) {
      untranslated.push(key);
    }
  }

  if (placeholderMismatches.length) {
    failed = true;
    console.error(`\n[${code}] Placeholder mismatches (${placeholderMismatches.length}):`);
    placeholderMismatches
      .slice(0, 15)
      .forEach(({ key, en, got }) => console.error(`  - ${key}: en [${en}] vs [${got}]`));
  }

  if (untranslated.length) {
    console.warn(`\n[${code}] Possibly untranslated (identical to en, ${untranslated.length}):`);
    untranslated
      .slice(0, 15)
      .forEach(k => console.warn(`  - ${k}: "${enFlat[k].slice(0, 60)}..."`));
    if (untranslated.length > 15) console.warn(`  ... and ${untranslated.length - 15} more`);
  }
}

const enCount = Object.keys(enFlat).length;
console.log(`\nChecked ${LOCALES.join(', ')} — ${enCount} keys in en.`);

if (failed) {
  console.error('\nLocale check FAILED.\n');
  process.exit(1);
}

console.log('Locale check passed (keys + placeholders).\n');
process.exit(0);
