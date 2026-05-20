export type PrivacyFilterAction = 'drop' | 'redact';

export interface PrivacyFilterRule {
  enabled: boolean;
  bucket_prefix?: string;
  field: string;
  pattern: string;
  action: PrivacyFilterAction;
  replacement?: string;
}

export interface PrivacyFilterValidationResult {
  rules: PrivacyFilterRule[] | null;
  errors: string[];
}

export const DEFAULT_PRIVACY_FILTERS: PrivacyFilterRule[] = [
  {
    enabled: true,
    bucket_prefix: 'aw-watcher-window',
    field: 'title',
    pattern: '(?i)(private browsing|incognito)',
    action: 'drop',
  },
  {
    enabled: true,
    bucket_prefix: 'aw-watcher-window',
    field: 'title',
    pattern: '(?i).*banking.*',
    action: 'redact',
    replacement: 'REDACTED',
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(
  value: unknown,
  fieldName: string,
  ruleNumber: number,
  errors: string[]
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== 'string') {
    errors.push(`Rule ${ruleNumber}: \`${fieldName}\` must be a string when provided.`);
    return undefined;
  }
  if (value.trim() === '') {
    errors.push(`Rule ${ruleNumber}: \`${fieldName}\` cannot be empty when provided.`);
    return undefined;
  }
  return value;
}

export function formatPrivacyFilters(rules: PrivacyFilterRule[]): string {
  return JSON.stringify(rules, null, 2);
}

export function validatePrivacyFiltersInput(input: string): PrivacyFilterValidationResult {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { rules: [], errors: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      rules: null,
      errors: [`Invalid JSON: ${message}`],
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      rules: null,
      errors: ['Top-level value must be a JSON array of privacy filter rules.'],
    };
  }

  const errors: string[] = [];
  const rules: PrivacyFilterRule[] = [];

  parsed.forEach((candidate, index) => {
    const ruleNumber = index + 1;
    if (!isRecord(candidate)) {
      errors.push(`Rule ${ruleNumber}: each rule must be a JSON object.`);
      return;
    }

    const errorCountBefore = errors.length;
    const enabled = candidate.enabled;
    if (typeof enabled !== 'boolean') {
      errors.push(`Rule ${ruleNumber}: \`enabled\` must be a boolean.`);
    }

    const pattern = candidate.pattern;
    if (typeof pattern !== 'string') {
      errors.push(`Rule ${ruleNumber}: \`pattern\` must be a string.`);
    } else if (pattern.trim() === '') {
      errors.push(`Rule ${ruleNumber}: \`pattern\` cannot be an empty string.`);
    }

    const bucketPrefix = optionalString(
      candidate.bucket_prefix,
      'bucket_prefix',
      ruleNumber,
      errors
    );
    let field: string | undefined;
    if (candidate.field === undefined || candidate.field === null) {
      errors.push(
        `Rule ${ruleNumber}: \`field\` is required so the rule only matches the intended event data.`
      );
    } else if (typeof candidate.field !== 'string') {
      errors.push(`Rule ${ruleNumber}: \`field\` must be a string.`);
    } else if (candidate.field.trim() === '') {
      errors.push(`Rule ${ruleNumber}: \`field\` cannot be an empty string.`);
    } else {
      field = candidate.field;
    }
    const replacement = optionalString(candidate.replacement, 'replacement', ruleNumber, errors);

    const action = candidate.action;
    if (action !== 'drop' && action !== 'redact') {
      errors.push(`Rule ${ruleNumber}: \`action\` must be either "drop" or "redact".`);
    }

    if (action === 'redact' && replacement === undefined) {
      errors.push(`Rule ${ruleNumber}: redact rules need a non-empty \`replacement\` string.`);
    }

    if (
      errors.length > errorCountBefore ||
      typeof enabled !== 'boolean' ||
      typeof pattern !== 'string' ||
      field === undefined ||
      (action !== 'drop' && action !== 'redact')
    ) {
      return;
    }

    rules.push({
      enabled,
      bucket_prefix: bucketPrefix,
      field,
      pattern,
      action,
      replacement,
    });
  });

  return {
    rules: errors.length === 0 ? rules : null,
    errors,
  };
}
