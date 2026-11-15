export interface AwNotifyAlert {
  category: string;
  label: string | null;
  thresholds_minutes: number[];
  positive: boolean;
}

export interface AwNotifyConfig {
  enabled?: boolean;
  alerts: AwNotifyAlert[];
  hourly_checkins?: boolean;
  new_day_greetings?: boolean;
  server_monitoring?: boolean;
  productivity_score?: boolean;
  http_port?: number;
}

interface LegacyAwNotifyAlert {
  category: string | null;
  label: string;
  thresholdMinutes: number[];
  positive: boolean;
}

export function parseThresholds(input: string): number[] | null {
  // Accept the Arabic comma (U+060C) as well: Arabic keyboards produce it, and
  // the Arabic locale's own placeholder example uses it.
  const values = input.split(/[,،]/).map(s => s.trim());
  if (values.some(part => !/^[1-9]\d*$/.test(part))) {
    return null;
  }
  return values.map(Number);
}

function isPositiveWholeMinutes(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(minutes => Number.isInteger(minutes) && minutes > 0)
  );
}

function hasOptionalBoolean(value: Record<string, unknown>, key: string): boolean {
  return value[key] === undefined || typeof value[key] === 'boolean';
}

function isAwNotifyAlert(value: unknown): value is AwNotifyAlert {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.category === 'string' &&
    (typeof candidate.label === 'string' || candidate.label === null) &&
    isPositiveWholeMinutes(candidate.thresholds_minutes) &&
    typeof candidate.positive === 'boolean'
  );
}

function isLegacyAlert(value: unknown): value is LegacyAwNotifyAlert {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    (typeof candidate.category === 'string' || candidate.category === null) &&
    typeof candidate.label === 'string' &&
    isPositiveWholeMinutes(candidate.thresholdMinutes) &&
    typeof candidate.positive === 'boolean'
  );
}

export function parseAwNotifyConfig(value: unknown): AwNotifyConfig | null {
  if (typeof value === 'object' && value !== null) {
    const config = value as Record<string, unknown>;
    if (
      Array.isArray(config.alerts) &&
      config.alerts.every(isAwNotifyAlert) &&
      hasOptionalBoolean(config, 'enabled') &&
      hasOptionalBoolean(config, 'hourly_checkins') &&
      hasOptionalBoolean(config, 'new_day_greetings') &&
      hasOptionalBoolean(config, 'server_monitoring') &&
      hasOptionalBoolean(config, 'productivity_score') &&
      (config.http_port === undefined ||
        (Number.isInteger(config.http_port) &&
          (config.http_port as number) >= 0 &&
          (config.http_port as number) <= 65535))
    ) {
      return config as unknown as AwNotifyConfig;
    }
  }

  // PR #923 briefly stored Android's original array schema. Read it so users can
  // migrate without losing settings, then always save the canonical desktop shape.
  if (Array.isArray(value) && value.every(isLegacyAlert)) {
    return {
      alerts: value.map(candidate => ({
        category: candidate.category ?? 'All',
        label: candidate.label || null,
        thresholds_minutes: candidate.thresholdMinutes,
        positive: candidate.positive,
      })),
    };
  }

  return null;
}

/** aw-notify-rs writes heartbeats to `aw-notify_<hostname>`. */
export const AW_NOTIFY_BUCKET_PREFIX = 'aw-notify_';

/**
 * aw-notify-rs heartbeats every 5 s with a 10 s pulsetime, so a running
 * daemon's last event always ends within seconds of now. Allow several missed
 * beats before reporting it as stopped.
 */
export const AW_NOTIFY_STALE_AFTER_MS = 30_000;

export type AwNotifyLiveness = 'running' | 'stopped' | 'never';

interface HeartbeatEvent {
  timestamp: string | Date;
  duration: number;
}

/**
 * Liveness from the latest event of each `aw-notify_*` bucket (null for an
 * empty bucket). Running if any heartbeat ended within the stale window;
 * `never` if no heartbeat bucket or event exists at all.
 */
export function awNotifyLiveness(
  latestEvents: (HeartbeatEvent | null)[],
  now: Date = new Date()
): AwNotifyLiveness {
  const events = latestEvents.filter((e): e is HeartbeatEvent => e !== null);
  if (events.length === 0) return 'never';
  const fresh = events.some(e => {
    const end = new Date(e.timestamp).getTime() + e.duration * 1000;
    return now.getTime() - end <= AW_NOTIFY_STALE_AFTER_MS;
  });
  return fresh ? 'running' : 'stopped';
}
