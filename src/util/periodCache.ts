// Shared invalidation for writes made through this UI. A short expiry also
// bounds staleness from external importers/watchers that cannot notify us.
let revision = 0;
export function invalidatePeriodCaches(): void {
  revision++;
}

export class PeriodCache<T> {
  private entries = new Map<string, { value: T; expires: number }>();
  private revision = revision;
  constructor(private limit = 256, private ttl = 60_000) {}

  get version(): number {
    return revision;
  }

  clear(): void {
    this.entries.clear();
    this.revision = revision;
  }

  get(key: string, now = Date.now()): T | undefined {
    if (this.revision !== revision) this.clear();
    const entry = this.entries.get(key);
    if (!entry || entry.expires <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, now = Date.now()): void {
    if (this.revision !== revision) this.clear();
    this.entries.delete(key);
    this.entries.set(key, { value, expires: now + this.ttl });
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value);
  }
}
