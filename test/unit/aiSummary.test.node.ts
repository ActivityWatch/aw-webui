import { callLLM, loadLLMConfig, saveLLMConfig } from '~/util/aiSummary';

describe('LLM config storage', () => {
  const values = new Map<string, string>();

  beforeAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        clear: () => values.clear(),
      },
      configurable: true,
    });
  });
  beforeEach(() => values.clear());

  test('persists provider settings without the API key', () => {
    saveLLMConfig({ provider: 'openai', model: 'gpt-4o-mini', apiKey: 'secret' });

    expect(loadLLMConfig()).toEqual({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(localStorage.getItem('aw-ai-summary-llm-config')).not.toContain('secret');
  });

  test('discards a stale unsupported provider', () => {
    localStorage.setItem(
      'aw-ai-summary-llm-config',
      JSON.stringify({ provider: 'custom', model: 'local-model' })
    );

    expect(loadLLMConfig()).toEqual({});
  });
});

describe('callLLM', () => {
  const fetchMock = jest.fn();

  beforeAll(() => {
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
    });
  });
  beforeEach(() => fetchMock.mockReset());

  test('sends OpenAI requests to the CSP-allowed endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Summary' } }] }),
    });

    await expect(
      callLLM({ provider: 'openai', apiKey: 'secret', model: 'gpt-4o-mini' }, 'Activity')
    ).resolves.toBe('Summary');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.any(Object)
    );
  });

  test('sends Anthropic requests to the CSP-allowed endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'Summary' }] }),
    });

    await expect(
      callLLM(
        { provider: 'anthropic', apiKey: 'secret', model: 'claude-haiku-4-5-20251001' },
        'Activity'
      )
    ).resolves.toBe('Summary');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.any(Object)
    );
  });
});
