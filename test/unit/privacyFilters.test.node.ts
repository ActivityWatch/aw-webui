import {
  DEFAULT_PRIVACY_FILTERS,
  formatPrivacyFilters,
  validatePrivacyFiltersInput,
} from '~/util/privacyFilters';

test('accepts the default privacy filters', () => {
  const result = validatePrivacyFiltersInput(formatPrivacyFilters(DEFAULT_PRIVACY_FILTERS));
  expect(result.errors).toEqual([]);
  expect(result.rules).toEqual(DEFAULT_PRIVACY_FILTERS);
});

test('rejects non-array JSON', () => {
  const result = validatePrivacyFiltersInput('{"enabled": true}');
  expect(result.rules).toBeNull();
  expect(result.errors).toEqual(['Top-level value must be a JSON array of privacy filter rules.']);
});

test('accepts regex strings that rely on server-side syntax validation', () => {
  const result = validatePrivacyFiltersInput(
    JSON.stringify([
      {
        enabled: true,
        bucket_prefix: 'aw-watcher-window',
        field: 'title',
        pattern: '(?i)private browsing',
        action: 'drop',
      },
    ])
  );
  expect(result.errors).toEqual([]);
  expect(result.rules).toEqual([
    {
      enabled: true,
      bucket_prefix: 'aw-watcher-window',
      field: 'title',
      pattern: '(?i)private browsing',
      action: 'drop',
    },
  ]);
});

test('rejects redact rules without a replacement', () => {
  const result = validatePrivacyFiltersInput(
    JSON.stringify([
      {
        enabled: true,
        bucket_prefix: 'aw-watcher-window',
        field: 'title',
        pattern: '(?i)banking',
        action: 'redact',
      },
    ])
  );
  expect(result.rules).toBeNull();
  expect(result.errors).toContain('Rule 1: redact rules need a non-empty `replacement` string.');
});

test('rejects rules without a field', () => {
  const result = validatePrivacyFiltersInput(
    JSON.stringify([
      {
        enabled: true,
        bucket_prefix: 'aw-watcher-window',
        pattern: '(?i)private browsing',
        action: 'drop',
      },
    ])
  );
  expect(result.rules).toBeNull();
  expect(result.errors).toContain(
    'Rule 1: `field` is required so the rule only matches the intended event data.'
  );
});

test('rejects blank fields without also reporting them as missing', () => {
  const result = validatePrivacyFiltersInput(
    JSON.stringify([
      {
        enabled: true,
        bucket_prefix: 'aw-watcher-window',
        field: '   ',
        pattern: '(?i)private browsing',
        action: 'drop',
      },
    ])
  );
  expect(result.rules).toBeNull();
  expect(result.errors).toEqual(['Rule 1: `field` cannot be an empty string.']);
});

test('rejects non-string fields without also reporting them as missing', () => {
  const result = validatePrivacyFiltersInput(
    JSON.stringify([
      {
        enabled: true,
        bucket_prefix: 'aw-watcher-window',
        field: 7,
        pattern: '(?i)private browsing',
        action: 'drop',
      },
    ])
  );
  expect(result.rules).toBeNull();
  expect(result.errors).toEqual(['Rule 1: `field` must be a string.']);
});

test('rejects empty pattern strings', () => {
  const result = validatePrivacyFiltersInput(
    JSON.stringify([
      {
        enabled: true,
        bucket_prefix: 'aw-watcher-window',
        field: 'title',
        pattern: '   ',
        action: 'drop',
      },
    ])
  );
  expect(result.rules).toBeNull();
  expect(result.errors).toContain('Rule 1: `pattern` cannot be an empty string.');
});

test('reports invalid action and missing field together', () => {
  const result = validatePrivacyFiltersInput(
    JSON.stringify([
      {
        enabled: true,
        pattern: '(?i)private browsing',
        action: 'remove',
      },
    ])
  );
  expect(result.rules).toBeNull();
  expect(result.errors).toEqual([
    'Rule 1: `field` is required so the rule only matches the intended event data.',
    'Rule 1: `action` must be either "drop" or "redact".',
  ]);
});

test('treats blank input as an empty rule set', () => {
  const result = validatePrivacyFiltersInput('   ');
  expect(result.errors).toEqual([]);
  expect(result.rules).toEqual([]);
});
