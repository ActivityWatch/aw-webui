export interface AppUsage {
  app: string;
  duration: number; // seconds
}

export interface ActivitySummaryData {
  topApps: AppUsage[];
  totalDuration: number; // seconds
  periodDays: number;
}

export function aggregateEvents(events: any[]): AppUsage[] {
  const byApp: Record<string, number> = {};
  for (const event of events) {
    const app = event.data?.app || event.data?.title || 'unknown';
    byApp[app] = (byApp[app] || 0) + (event.duration || 0);
  }
  return Object.entries(byApp)
    .map(([app, duration]) => ({ app, duration }))
    .sort((a, b) => b.duration - a.duration);
}

export function formatDurationHuman(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function buildSummaryText(data: ActivitySummaryData): string {
  const lines: string[] = [
    `Activity summary — past ${data.periodDays} day(s):`,
    `Total tracked time: ${formatDurationHuman(data.totalDuration)}`,
    '',
    'Top applications by time:',
  ];
  for (const item of data.topApps.slice(0, 20)) {
    lines.push(`  ${item.app}: ${formatDurationHuman(item.duration)}`);
  }
  return lines.join('\n');
}

export type LLMProvider = 'openai' | 'anthropic' | 'custom';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // used when provider === 'custom'
}

const LS_KEY = 'aw-ai-summary-llm-config';

export function loadLLMConfig(): Partial<LLMConfig> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLLMConfig(config: Partial<LLMConfig>): void {
  localStorage.setItem(LS_KEY, JSON.stringify(config));
}

export async function callLLM(config: LLMConfig, userMessage: string): Promise<string> {
  if (!config.apiKey) throw new Error('API key is required');

  if (config.provider === 'openai' || config.provider === 'custom') {
    const baseUrl =
      config.provider === 'custom'
        ? (config.baseUrl || '').replace(/\/$/, '')
        : 'https://api.openai.com';
    const url = `${baseUrl}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: userMessage }],
        max_tokens: 1024,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  }

  if (config.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model || 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 200)}`);
    }
    const data = await res.json();
    return data.content?.[0]?.text ?? '';
  }

  throw new Error(`Unknown provider: ${config.provider}`);
}
