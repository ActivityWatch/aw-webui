import Vue from 'vue';
import { createLocalVue, mount, Wrapper } from '@vue/test-utils';
import BootstrapVue from 'bootstrap-vue';
import { createPinia, defineStore, PiniaVuePlugin, setActivePinia } from 'pinia';
import AISummaryView from '~/views/AISummaryView.vue';
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { getClient } from '~/util/awclient';
import { callLLM, loadLLMConfig } from '~/util/aiSummary';

jest.mock('~/stores/buckets', () => ({ useBucketsStore: jest.fn() }));
jest.mock('~/stores/categories', () => ({ useCategoryStore: jest.fn() }));
jest.mock('~/util/awclient', () => ({ getClient: jest.fn() }));
jest.mock('~/util/aiSummary', () => ({
  loadLLMConfig: jest.fn(),
  saveLLMConfig: jest.fn(),
  callLLM: jest.fn(),
}));

const localVue = createLocalVue();
localVue.use(PiniaVuePlugin);
localVue.use(BootstrapVue);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Drain promises AND Vue's watcher queue without timers or real requests.
async function flush() {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
    await Vue.nextTick();
  }
}

const bucket = (id: string, type: string, hostname: string) => ({ id, type, hostname });
const useTestBuckets = defineStore('ai-summary-test-buckets', {
  state: () => ({
    buckets: [
      bucket('window-alpha', 'currentwindow', 'alpha'),
      bucket('window-beta', 'currentwindow', 'beta'),
      bucket('afk-alpha', 'afkstatus', 'alpha'),
      bucket('aw-watcher-web-chrome-alpha', 'web.tab.current', 'alpha'),
      bucket('aw-watcher-web-chrome-beta', 'web.tab.current', 'beta'),
      bucket('aw-watcher-web-firefox-legacy', 'web.tab.current', 'unknown'),
    ],
  }),
  actions: {
    async ensureLoaded() {
      return undefined;
    },
    bucketsByType(host: string, type: string, fallback = false): string[] {
      return this.buckets
        .filter(
          b => b.type === type && (b.hostname === host || (fallback && b.hostname === 'unknown'))
        )
        .map(b => b.id);
    },
    bucketsWindow(host: string): string[] {
      return this.bucketsByType(host, 'currentwindow').filter(
        id => !id.startsWith('aw-watcher-android')
      );
    },
    bucketsBrowser(host: string): string[] {
      return this.bucketsByType(host, 'web.tab.current', true);
    },
  },
});
const useTestCategories = defineStore('ai-summary-test-categories', {
  state: () => ({
    classes: [
      { name: ['Work'], rule: { type: 'regex', regex: 'editor' }, data: { private: false } },
      { name: ['Private'], rule: { type: 'regex', regex: 'secret' }, data: { private: true } },
    ],
  }),
  getters: {
    classes_for_query: state => state.classes.map(c => [c.name, c.rule]),
  },
  actions: {
    async load() {
      return undefined;
    },
  },
});

const queryResult = () => [
  {
    tracked_duration: 1200,
    events: [
      {
        timestamp: '2026-10-30T12:00:00Z',
        duration: 300,
        data: { app: 'editor', title: 'RAW-TITLE', $category: ['Work'] },
      },
      {
        timestamp: '2026-10-30T12:05:00Z',
        duration: 120,
        data: { app: 'secret-app', title: 'SECRET-TITLE', $category: ['Private', 'Child'] },
      },
      {
        timestamp: '2026-10-30T12:07:00Z',
        duration: 60,
        data: { app: 'uncategorized-app', $category: ['Uncategorized'] },
      },
    ],
    browser_domains: [{ duration: 100, data: { $domain: 'example.org' } }],
  },
];

describe('AI Summary mounted invocation ownership', () => {
  let wrapper: Wrapper<Vue>;
  let buckets: ReturnType<typeof useTestBuckets>;
  let categories: ReturnType<typeof useTestCategories>;
  let query: jest.Mock;
  let pendingQuery: ReturnType<typeof deferred<ReturnType<typeof queryResult>>>;
  const llm = callLLM as jest.Mock;
  const vm = () => wrapper.vm as any;
  const generateButton = () => wrapper.find('button.btn-primary');

  async function mountView() {
    wrapper = mount(AISummaryView as any, {
      localVue,
      mocks: { $t: (key: string) => key },
      stubs: { icon: true },
    });
    await flush();
  }
  async function startQuery() {
    await generateButton().trigger('click');
    await flush();
    expect(query).toHaveBeenCalledTimes(1);
    expect(vm().loading).toBe(true);
    expect(generateButton().attributes('disabled')).toBeDefined();
    // Busy ownership must not be implemented by freezing the controls.
    wrapper.findAll('select, input, textarea').wrappers.forEach(control => {
      expect(control.attributes('disabled')).toBeUndefined();
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    setActivePinia(createPinia());
    buckets = useTestBuckets();
    categories = useTestCategories();
    (useBucketsStore as unknown as jest.Mock).mockReturnValue(buckets);
    (useCategoryStore as unknown as jest.Mock).mockReturnValue(categories);
    (loadLLMConfig as jest.Mock).mockReturnValue({
      provider: 'openai',
      apiKey: ' test-key ',
      model: '',
    });
    pendingQuery = deferred<ReturnType<typeof queryResult>>();
    query = jest.fn().mockReturnValue(pendingQuery.promise);
    (getClient as jest.Mock).mockReturnValue({ query });
    llm.mockResolvedValue('Fresh summary');
  });
  afterEach(() => {
    if (wrapper) wrapper.destroy();
  });

  test('changing host during a deferred query cancels provider dispatch and releases busy state only after settlement', async () => {
    await mountView();
    await startQuery();
    await wrapper.findAll('select').at(0).setValue('beta');
    expect(vm().selectedHost).toBe('beta');
    expect(vm().loading).toBe(true);
    pendingQuery.resolve(queryResult());
    await flush();
    expect(llm).not.toHaveBeenCalled();
    expect(vm().aggregatedText).toBe('');
    expect(vm().llmResponse).toBe('');
    expect(vm().error).toBe('');
    expect(vm().loading).toBe(false);
    expect(generateButton().attributes('disabled')).toBeUndefined();
  });

  // Real DOM events are important: BootstrapVue updates v-model and @change in
  // different steps. Store cases deliberately mutate nested reactive properties.
  const edits: [string, () => Promise<void>][] = [
    [
      'host',
      async () => {
        await wrapper.findAll('select').at(0).setValue('beta');
      },
    ],
    [
      'date range',
      async () => {
        await wrapper.findAll('select').at(1).setValue('last30d');
      },
    ],
    [
      'private categories: loosen',
      async () => {
        await wrapper.findAll('input[type="checkbox"]').at(1).setChecked(false);
      },
    ],
    [
      'uncategorized: restrict',
      async () => {
        await wrapper.findAll('input[type="checkbox"]').at(0).setChecked(true);
      },
    ],
    [
      'prompt',
      async () => {
        await wrapper.find('textarea').setValue('New instructions');
      },
    ],
    [
      'provider',
      async () => {
        await wrapper.findAll('select').at(2).setValue('anthropic');
      },
    ],
    [
      'model',
      async () => {
        await wrapper.find('input[type="text"]').setValue('custom-model');
      },
    ],
    [
      'API key',
      async () => {
        await wrapper.find('input[type="password"]').setValue('replacement-key');
      },
    ],
    [
      'nested category rule',
      async () => {
        categories.classes[0].rule.regex = 'new-rule';
        await flush();
      },
    ],
    [
      'nested private metadata: loosen',
      async () => {
        categories.classes[1].data.private = false;
        await flush();
      },
    ],
    [
      'nested private metadata: restrict descendants and domains',
      async () => {
        categories.classes[0].data.private = true;
        await flush();
      },
    ],
    [
      'nested bucket metadata',
      async () => {
        buckets.buckets[3].hostname = 'beta';
        await flush();
      },
    ],
    [
      'combined controls and store inputs',
      async () => {
        await wrapper.findAll('select').at(0).setValue('beta');
        await wrapper.findAll('select').at(1).setValue('last90d');
        await wrapper.find('textarea').setValue('Combined edit');
        categories.classes[0].data.private = true;
        await wrapper.findAll('select').at(2).setValue('anthropic');
        await wrapper.find('input[type="password"]').setValue('other-key');
        await flush();
      },
    ],
  ];

  test.each(edits)(
    '%s invalidates a pending query without sending to a provider',
    async (_name, edit) => {
      await mountView();
      await startQuery();
      await edit();
      expect(vm().loading).toBe(true);
      expect(generateButton().attributes('disabled')).toBeDefined();
      // Disabled UI clicks must be harmless too; direct duplicate invocation has
      // its own test so it cannot mask individual invalidation regressions.
      await generateButton().trigger('click');
      pendingQuery.resolve(queryResult());
      await flush();
      expect(query).toHaveBeenCalledTimes(1);
      expect(llm).not.toHaveBeenCalled();
      expect(vm().aggregatedText).toBe('');
      expect(vm().llmResponse).toBe('');
      expect(vm().error).toBe('');
      expect(vm().loading).toBe(false);
      expect(generateButton().attributes('disabled')).toBeUndefined();
    }
  );

  test('edit-and-revert after Vue flush does not revive the original query', async () => {
    await mountView();
    await startQuery();
    const original = vm().userPrompt;
    await wrapper.find('textarea').setValue('Temporary edit');
    await flush();
    await wrapper.find('textarea').setValue(original);
    pendingQuery.resolve(queryResult());
    await flush();
    expect(llm).not.toHaveBeenCalled();
    expect(vm().aggregatedText).toBe('');
    expect(vm().loading).toBe(false);
  });

  test.each(edits)('%s clears an old preview and response immediately', async (_name, edit) => {
    await mountView();
    await startQuery();
    pendingQuery.resolve(queryResult());
    await flush();
    expect(vm().llmResponse).toBe('Fresh summary');
    await wrapper.find('button.btn-outline-secondary').trigger('click');
    expect(wrapper.find('pre').exists()).toBe(true);
    await edit();
    await flush();
    expect(vm().aggregatedText).toBe('');
    expect(vm().llmResponse).toBe('');
    expect(wrapper.find('pre').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Fresh summary');
    expect(query).toHaveBeenCalledTimes(1);
    expect(llm).toHaveBeenCalledTimes(1);
  });

  test.each(['resolve', 'reject'])(
    'pending provider %s cannot republish after invalidation',
    async settlement => {
      const provider = deferred<string>();
      llm.mockReturnValue(provider.promise);
      await mountView();
      await startQuery();
      pendingQuery.resolve(queryResult());
      await flush();
      expect(llm).toHaveBeenCalledTimes(1);
      expect(vm().aggregatedText).toContain('Host(s): alpha');
      await wrapper.find('textarea').setValue('Changed after dispatch');
      await flush();
      expect(vm().aggregatedText).toBe('');
      expect(vm().loading).toBe(true);
      expect(generateButton().attributes('disabled')).toBeDefined();
      if (settlement === 'resolve') provider.resolve('STALE provider result');
      else provider.reject(new Error('STALE provider failure'));
      await flush();
      expect(vm().llmResponse).toBe('');
      expect(vm().error).toBe('');
      expect(vm().loading).toBe(false);
      expect(wrapper.text()).not.toContain('STALE');
      // Once the old stage settles a new generation must work normally.
      query.mockResolvedValue(queryResult());
      llm.mockResolvedValue('Second fresh result');
      await generateButton().trigger('click');
      await flush();
      expect(vm().llmResponse).toBe('Second fresh result');
      expect(query).toHaveBeenCalledTimes(2);
      expect(llm).toHaveBeenCalledTimes(2);
      expect(llm.mock.calls[1][1]).toContain('Changed after dispatch');
    }
  );

  test.each(edits)('%s invalidates an already-dispatched provider result', async (_name, edit) => {
    const provider = deferred<string>();
    llm.mockReturnValue(provider.promise);
    await mountView();
    await startQuery();
    pendingQuery.resolve(queryResult());
    await flush();
    expect(llm).toHaveBeenCalledTimes(1);
    expect(vm().aggregatedText).not.toBe('');
    await edit();
    await flush();
    expect(vm().loading).toBe(true);
    expect(vm().aggregatedText).toBe('');
    provider.resolve('STALE dispatched response');
    await flush();
    expect(vm().llmResponse).toBe('');
    expect(vm().error).toBe('');
    expect(vm().loading).toBe(false);
    expect(query).toHaveBeenCalledTimes(1);
    expect(llm).toHaveBeenCalledTimes(1);
  });

  test('unchanged invocation uses real context privacy filtering and actual AFK/browser query builder', async () => {
    await mountView();
    await startQuery();
    const [ranges, statements] = query.mock.calls[0];
    expect(ranges).toHaveLength(1);
    expect(ranges[0].end.getTime() - ranges[0].start.getTime()).toBe(7 * 86400000);
    const queryText = statements.join('\n');
    for (const id of [
      'window-alpha',
      'afk-alpha',
      'aw-watcher-web-chrome-alpha',
      'aw-watcher-web-firefox-legacy',
    ]) {
      expect(queryText).toContain(id);
    }
    expect(queryText).not.toContain('aw-watcher-web-chrome-beta');
    expect(queryText).not.toContain('window-beta');
    expect(queryText).toContain('filter_period_intersect');
    expect(queryText).toContain('categorize');
    expect(queryText).toContain('editor');
    pendingQuery.resolve(queryResult());
    await flush();
    expect(llm).toHaveBeenCalledTimes(1);
    const [config, sentPrompt] = llm.mock.calls[0];
    expect(config).toEqual({ provider: 'openai', apiKey: 'test-key', model: 'gpt-4o-mini' });
    expect(sentPrompt).toContain('Host(s): alpha');
    expect(sentPrompt).toContain('active after AFK filtering: 8m (40%)');
    expect(sentPrompt).toContain('Summarized below: 6m');
    expect(sentPrompt).toContain('withheld 2m');
    expect(sentPrompt).toContain('hostname could not be resolved');
    expect(sentPrompt).toContain('editor: 5m');
    for (const secret of [
      'RAW-TITLE',
      'SECRET-TITLE',
      'secret-app',
      'Private > Child',
      'example.org',
    ]) {
      expect(sentPrompt).not.toContain(secret);
    }
    expect(vm().llmResponse).toBe('Fresh summary');
    expect(vm().loading).toBe(false);
    expect(vm().error).toBe('');
  });

  test.each([
    [false, false, true, true],
    [false, true, false, false],
    [true, true, false, false],
  ])(
    'privacy: private=%s uncategorized=%s domains=%s uncategorized app=%s',
    async (privateOn, uncategorizedOn, domains, uncategorizedApp) => {
      await mountView();
      await wrapper.findAll('input[type="checkbox"]').at(1).setChecked(privateOn);
      await wrapper.findAll('input[type="checkbox"]').at(0).setChecked(uncategorizedOn);
      await startQuery();
      pendingQuery.resolve(queryResult());
      await flush();
      const sentPrompt = llm.mock.calls[0][1];
      expect(sentPrompt.includes('example.org')).toBe(domains);
      expect(sentPrompt.includes('uncategorized-app')).toBe(uncategorizedApp);
      expect(sentPrompt.includes('secret-app')).toBe(!privateOn);
    }
  );

  test('restricting private filtering during a query cancels rather than leaking descendants/domains', async () => {
    await mountView();
    await wrapper.findAll('input[type="checkbox"]').at(1).setChecked(false);
    await startQuery();
    await wrapper.findAll('input[type="checkbox"]').at(1).setChecked(true);
    pendingQuery.resolve(queryResult());
    await flush();
    expect(llm).not.toHaveBeenCalled();
    expect(vm().aggregatedText).toBe('');
  });

  test('loosening uncategorized filtering during a query also cancels', async () => {
    await mountView();
    await wrapper.findAll('input[type="checkbox"]').at(0).setChecked(true);
    await startQuery();
    await wrapper.findAll('input[type="checkbox"]').at(0).setChecked(false);
    pendingQuery.resolve(queryResult());
    await flush();
    expect(llm).not.toHaveBeenCalled();
  });

  test.each([
    ['openai', '', 'gpt-4o-mini'],
    ['openai', '   ', 'gpt-4o-mini'],
    ['openai', ' custom-model ', 'custom-model'],
    ['anthropic', '', 'claude-haiku-4-5-20251001'],
    ['anthropic', '   ', 'claude-haiku-4-5-20251001'],
    ['anthropic', ' custom-model ', 'custom-model'],
  ])(
    '%s model %j launches with effective model %s and trimmed key',
    async (provider, model, effectiveModel) => {
      await mountView();
      await wrapper.findAll('select').at(2).setValue(provider);
      await wrapper.find('input[type="text"]').setValue(model);
      await startQuery();
      pendingQuery.resolve(queryResult());
      await flush();
      expect(llm).toHaveBeenCalledWith(
        { provider, apiKey: 'test-key', model: effectiveModel },
        expect.any(String)
      );
      expect(vm().llmResponse).toBe('Fresh summary');
    }
  );

  test('provider switches update default models without overwriting a custom model', async () => {
    await mountView();
    await wrapper.findAll('select').at(2).setValue('anthropic');
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe(
      'claude-haiku-4-5-20251001'
    );
    await wrapper.findAll('select').at(2).setValue('openai');
    expect(vm().model).toBe('gpt-4o-mini');
    await wrapper.find('input[type="text"]').setValue('my-model');
    await wrapper.findAll('select').at(2).setValue('anthropic');
    expect(vm().model).toBe('my-model');
    expect(query).not.toHaveBeenCalled();
    expect(llm).not.toHaveBeenCalled();
  });

  test.each(['no host', 'blank key'])(
    '%s cannot query or call provider even through direct invocation',
    async condition => {
      if (condition === 'no host') buckets.buckets = [];
      await mountView();
      if (condition === 'blank key') await wrapper.find('input[type="password"]').setValue('   ');
      await vm().generate();
      await flush();
      expect(query).not.toHaveBeenCalled();
      expect(llm).not.toHaveBeenCalled();
      expect(vm().error).toBe(
        condition === 'no host' ? 'ui.aiSummary.noHost' : 'ui.aiSummary.apiKeyRequired'
      );
      expect(vm().loading).toBe(false);
    }
  );

  test('empty results produce a valid empty summary context', async () => {
    await mountView();
    await startQuery();
    pendingQuery.resolve([{}] as ReturnType<typeof queryResult>);
    await flush();
    expect(llm).toHaveBeenCalledTimes(1);
    expect(llm.mock.calls[0][1]).toContain('active after AFK filtering: 0s');
    expect(llm.mock.calls[0][1]).toContain('Summarized below: 0s');
    expect(vm().llmResponse).toBe('Fresh summary');
    expect(vm().loading).toBe(false);
  });

  test.each(['query', 'provider'])(
    'current %s failures surface and release busy state',
    async stage => {
      if (stage === 'provider') llm.mockRejectedValue(new Error('current failure'));
      await mountView();
      await startQuery();
      if (stage === 'query') pendingQuery.reject(new Error('current failure'));
      else pendingQuery.resolve(queryResult());
      await flush();
      expect(vm().error).toBe('current failure');
      expect(vm().loading).toBe(false);
      expect(vm().llmResponse).toBe('');
      expect(llm).toHaveBeenCalledTimes(stage === 'query' ? 0 : 1);
      expect(generateButton().attributes('disabled')).toBeUndefined();
      // Editing clears obsolete errors, and the next attempt starts afresh.
      await wrapper.find('textarea').setValue('Retry instructions');
      await flush();
      expect(vm().error).toBe('');
      expect(vm().aggregatedText).toBe('');
      query.mockResolvedValue(queryResult());
      llm.mockResolvedValue('Recovered');
      await generateButton().trigger('click');
      await flush();
      expect(vm().llmResponse).toBe('Recovered');
      expect(vm().loading).toBe(false);
      expect(query).toHaveBeenCalledTimes(2);
      expect(llm).toHaveBeenCalledTimes(stage === 'query' ? 1 : 2);
    }
  );

  test('invalidated query failure does not publish an obsolete error', async () => {
    await mountView();
    await startQuery();
    await wrapper.findAll('select').at(1).setValue('last90d');
    pendingQuery.reject(new Error('STALE query failure'));
    await flush();
    expect(vm().error).toBe('');
    expect(vm().loading).toBe(false);
    expect(llm).not.toHaveBeenCalled();
  });

  test('repeated generate while unchanged and busy does not start another query', async () => {
    await mountView();
    await startQuery();
    const duplicate = vm().generate();
    await flush();
    const callsWhileBusy = query.mock.calls.length;
    pendingQuery.resolve(queryResult());
    await duplicate;
    await flush();
    expect(callsWhileBusy).toBe(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(llm).toHaveBeenCalledTimes(1);
  });

  test.each(['query', 'provider resolve', 'provider reject'])(
    'unmount during %s prevents dispatch or stale publication',
    async stage => {
      const provider = deferred<string>();
      llm.mockReturnValue(provider.promise);
      await mountView();
      await startQuery();
      if (stage !== 'query') {
        pendingQuery.resolve(queryResult());
        await flush();
        expect(llm).toHaveBeenCalledTimes(1);
      }
      const instance = vm();
      wrapper.destroy();
      const responseAtDestroy = instance.llmResponse;
      const errorAtDestroy = instance.error;
      const previewAtDestroy = instance.aggregatedText;
      if (stage === 'query') pendingQuery.resolve(queryResult());
      else if (stage === 'provider resolve') provider.resolve('STALE after destroy');
      else provider.reject(new Error('STALE after destroy'));
      await flush();
      expect(llm).toHaveBeenCalledTimes(stage === 'query' ? 0 : 1);
      expect(instance.llmResponse).toBe(responseAtDestroy);
      expect(instance.error).toBe(errorAtDestroy);
      expect(instance.aggregatedText).toBe(previewAtDestroy);
    }
  );
});
