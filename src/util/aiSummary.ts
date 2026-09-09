/**
 * LLM provider plumbing for the AI activity summary page.
 *
 * The activity context sent to the provider is built by `~/util/activityContext`.
 */

export type LLMProvider = 'openai' | 'anthropic';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
}

const LS_KEY = 'aw-ai-summary-llm-config';

export function loadLLMConfig(): Partial<LLMConfig> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const config: Partial<LLMConfig> = raw ? JSON.parse(raw) : {};
    if (config.provider !== 'openai' && config.provider !== 'anthropic') {
      delete config.provider;
      delete config.model;
    }
    return config;
  } catch {
    return {};
  }
}

export function saveLLMConfig(config: Partial<LLMConfig>): void {
  const persistedConfig = { ...config };
  delete persistedConfig.apiKey;
  localStorage.setItem(LS_KEY, JSON.stringify(persistedConfig));
}

export async function callLLM(config: LLMConfig, userMessage: string): Promise<string> {
  if (!config.apiKey) throw new Error('API key is required');

  if (config.provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
