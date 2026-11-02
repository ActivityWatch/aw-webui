<template lang="pug">
div
  h3.mb-3 {{ $t('ui.aiSummary.title') }}

  b-alert(variant="info" show)
    | {{ $t('ui.aiSummary.privacy') }}

  div.row.mb-3
    div.col-md-4
      b-form-group(:label="$t('ui.aiSummary.host')" label-class="font-weight-bold")
        b-form-select(v-model="selectedHost" :options="hostOptions")

    div.col-md-4
      b-form-group(:label="$t('ui.aiSummary.dateRange')" label-class="font-weight-bold")
        b-form-select(v-model="dateRange" :options="dateRangeOptions")

    div.col-md-4
      b-form-group(:label="$t('ui.aiSummary.provider')" label-class="font-weight-bold")
        b-form-select(v-model="provider" :options="providerOptions" @change="onProviderChange")

  div.row.mb-3
    div.col-md-6
      b-form-group(:label="$t('ui.aiSummary.apiKey')" label-class="font-weight-bold")
        b-form-input(
          v-model="apiKey"
          type="password"
          placeholder="sk-..."
          autocomplete="off"
          @blur="persistConfig"
        )

    div.col-md-6
      b-form-group(:label="$t('ui.aiSummary.model')" label-class="font-weight-bold")
        b-form-input(v-model="model" placeholder="e.g. gpt-4o-mini" @blur="persistConfig")

  div.mb-3
    b-form-group(:label="$t('ui.aiSummary.privacyTitle')" label-class="font-weight-bold")
      b-form-checkbox(v-model="excludeUncategorized")
        | {{ $t('ui.aiSummary.excludeUncategorized') }}
      b-form-checkbox(v-model="excludePrivateCategories")
        | {{ $t('ui.aiSummary.excludePrivate') }}
        span.text-muted.ml-1(v-if="privateCategories.length")
          | ({{ privateCategories.map(c => c.join(' > ')).join(', ') }})
        span.text-muted.ml-1(v-else)
          | ({{ $t('ui.aiSummary.noPrivateCategories') }} — #[code private: true])
      small.text-muted
        | {{ $t('ui.aiSummary.browserPrivacyHelp') }}

  div.mb-3
    b-form-group(:label="$t('ui.aiSummary.prompt')" label-class="font-weight-bold")
      b-form-textarea(v-model="userPrompt" rows="3" max-rows="8")

  div.mb-4
    b-button(@click="generate" variant="primary" :disabled="loading || !apiKey || !selectedHost")
      b-spinner.mr-2(v-if="loading" small)
      | {{ loading ? $t('ui.aiSummary.generating') : $t('ui.aiSummary.generate') }}
    b-button.ml-2(
      v-if="aggregatedText"
      variant="outline-secondary"
      @click="dataVisible = !dataVisible"
    ) {{ dataVisible ? $t('ui.aiSummary.hideRaw') : $t('ui.aiSummary.showRaw') }}

  b-alert(v-if="error" variant="danger" show dismissible @dismissed="error = ''")
    | {{ error }}

  div(v-if="dataVisible && aggregatedText")
    b-card.mb-3
      template(slot="header")
        strong {{ $t('ui.aiSummary.rawData') }}
      pre.mb-0(style="white-space: pre-wrap; font-size: 0.85em") {{ aggregatedText }}

  div(v-if="llmResponse")
    b-card
      template(slot="header")
        div.d-flex.justify-content-between.align-items-center
          strong {{ $t('ui.aiSummary.title') }}
          b-button(size="sm" variant="outline-secondary" @click="copyResponse")
            icon(name="copy")
            |  {{ copied ? $t('ui.aiSummary.copied') : $t('ui.aiSummary.copy') }}
      div(style="white-space: pre-wrap") {{ llmResponse }}
</template>

<script lang="ts">
import { useBucketsStore } from '~/stores/buckets';
import { useCategoryStore } from '~/stores/categories';
import { getClient } from '~/util/awclient';
import { analysisContextQuery, type DesktopQueryParams } from '~/queries';
import { loadLLMConfig, saveLLMConfig, callLLM, type LLMProvider } from '~/util/aiSummary';
import {
  buildActivityContext,
  formatActivityContext,
  privateCategoriesFrom,
  type CategoryName,
} from '~/util/activityContext';
import 'vue-awesome/icons/copy';

const DEFAULT_PROMPT =
  'Based on the following activity data, provide a concise summary of how I spent my time. ' +
  'Highlight the main activities, identify focus areas, and suggest any observations about productivity patterns.';

interface SummaryInvocation {
  host: string;
  days: number;
  provider: LLMProvider;
  apiKey: string;
  model: string;
  prompt: string;
  excludeUncategorized: boolean;
  privateCategories: CategoryName[];
  excludePrivateCategories: boolean;
  categories: DesktopQueryParams['categories'];
  windowBucketId: string;
  afkBucketId: string;
  browserBuckets: string[];
  browserFallbackUsed: boolean;
}

export default {
  name: 'AISummaryView',
  data() {
    const saved = loadLLMConfig();
    return {
      bucketsStore: useBucketsStore(),
      categoryStore: useCategoryStore(),

      selectedHost: '',
      dateRange: 'last7d',
      provider: (saved.provider || 'openai') as LLMProvider,
      apiKey: saved.apiKey || '',
      model: saved.model || '',
      userPrompt: DEFAULT_PROMPT,
      excludeUncategorized: false,
      excludePrivateCategories: true,

      loading: false,
      invocationVersion: 0,
      error: '',
      aggregatedText: '',
      llmResponse: '',
      dataVisible: false,
      copied: false,
    };
  },
  computed: {
    hostOptions(): { value: string; text: string }[] {
      const buckets = this.bucketsStore.buckets || [];
      const hosts = new Set<string>();
      for (const b of buckets) {
        // This view builds a desktop query (window + AFK + browser). Exclude
        // Android buckets so Android-only hosts are not offered: aw-watcher-android
        // uses the same 'currentwindow' type but its events would be intersected
        // with a desktop AFK bucket, yielding wrong or empty results.
        if (b.type === 'currentwindow' && !b.id.startsWith('aw-watcher-android')) {
          hosts.add(b.hostname);
        }
      }
      return Array.from(hosts).map(h => ({ value: h, text: h }));
    },
    dateRangeOptions() {
      return [
        { value: 'last7d', text: this.$t('common.last7d') },
        { value: 'last30d', text: this.$t('common.last30d') },
        { value: 'last90d', text: this.$t('common.last90d') },
      ];
    },
    providerOptions() {
      return [
        { value: 'openai', text: 'OpenAI' },
        { value: 'anthropic', text: 'Anthropic' },
      ];
    },
    periodDays(): number {
      return this.dateRange === 'last7d' ? 7 : this.dateRange === 'last30d' ? 30 : 90;
    },
    privateCategories(): CategoryName[] {
      return privateCategoriesFrom(this.categoryStore.classes || []);
    },
    defaultModel(): string {
      if (this.provider === 'anthropic') return 'claude-haiku-4-5-20251001';
      return 'gpt-4o-mini';
    },
    invocationInputs(): SummaryInvocation {
      const host = this.selectedHost;
      const afkBucket = (this.bucketsStore.buckets || []).find(
        b => b.type === 'afkstatus' && b.hostname === host
      );
      const browserBuckets = this.bucketsStore.bucketsBrowser(host);
      return {
        host,
        days: this.periodDays,
        provider: this.provider,
        apiKey: this.apiKey,
        model: this.model,
        prompt: this.userPrompt,
        excludeUncategorized: this.excludeUncategorized,
        privateCategories: this.privateCategories,
        excludePrivateCategories: this.excludePrivateCategories,
        categories: this.categoryStore.classes_for_query,
        windowBucketId: this.bucketsStore.bucketsWindow(host)[0] || '',
        afkBucketId: afkBucket ? afkBucket.id : '',
        browserBuckets,
        browserFallbackUsed:
          browserBuckets.length > this.bucketsStore.bucketsByType(host, 'web.tab.current').length,
      };
    },
  },
  watch: {
    // A privacy tightening must cancel, not be bypassed by an earlier snapshot.
    // Deep observation also catches in-place category/rule edits. The version
    // makes invalidation sticky if a user edits and then restores a control.
    invocationInputs: {
      deep: true,
      handler() {
        this.invalidateInvocation();
      },
    },
  },
  beforeDestroy() {
    this.invalidateInvocation();
  },
  async mounted() {
    await this.bucketsStore.ensureLoaded();
    await this.categoryStore.load();
    if (this.hostOptions.length > 0 && !this.selectedHost) {
      this.selectedHost = this.hostOptions[0].value;
    }
    if (!this.model) {
      this.model = this.defaultModel;
    }
  },
  methods: {
    onProviderChange() {
      if (
        !this.model ||
        this.model === 'gpt-4o-mini' ||
        this.model === 'claude-haiku-4-5-20251001'
      ) {
        this.model = this.defaultModel;
      }
      this.persistConfig();
    },
    persistConfig() {
      saveLLMConfig({
        provider: this.provider,
        apiKey: this.apiKey,
        model: this.model,
      });
    },
    invalidateInvocation() {
      this.invocationVersion++;
      this.error = '';
      this.llmResponse = '';
      this.aggregatedText = '';
      this.dataVisible = false;
      this.copied = false;
    },
    async generate() {
      if (this.loading) return;
      this.error = '';
      this.llmResponse = '';
      this.aggregatedText = '';

      if (!this.selectedHost) {
        this.error = this.$t('ui.aiSummary.noHost');
        return;
      }
      if (!this.apiKey.trim()) {
        this.error = this.$t('ui.aiSummary.apiKeyRequired');
        return;
      }

      // Detach nested category names/rules and private lists from mutable stores.
      const serializedInputs = JSON.stringify(this.invocationInputs);
      const invocation: SummaryInvocation = JSON.parse(serializedInputs);
      const version = this.invocationVersion;
      // The comparison also catches edits before Vue's batched watcher runs.
      const isCurrent = () =>
        version === this.invocationVersion &&
        serializedInputs === JSON.stringify(this.invocationInputs);
      this.loading = true;
      try {
        const summaryText = await this.buildContextText(invocation);
        if (!isCurrent()) return;
        this.aggregatedText = summaryText;

        const fullPrompt = `${invocation.prompt}\n\n${summaryText}`;
        const effectiveModel =
          invocation.model.trim() ||
          (invocation.provider === 'anthropic' ? 'claude-haiku-4-5-20251001' : 'gpt-4o-mini');

        const response = await callLLM(
          {
            provider: invocation.provider,
            apiKey: invocation.apiKey.trim(),
            model: effectiveModel,
          },
          fullPrompt
        );
        if (isCurrent()) this.llmResponse = response;
      } catch (err: any) {
        if (isCurrent()) this.error = err?.message || String(err);
      } finally {
        this.loading = false;
      }
    },
    async buildContextText(invocation: SummaryInvocation = this.invocationInputs): Promise<string> {
      // Use the store's bucketsWindow() filter: it excludes aw-watcher-android
      // buckets which share the 'currentwindow' type but sort before the desktop
      // watcher, so a naive find() could silently select an Android bucket.
      const windowBucketId = invocation.windowBucketId;
      if (!windowBucketId) {
        throw new Error(`No window-watcher bucket found for host: ${invocation.host}`);
      }
      // Only include browser buckets for the selected host; mixing buckets from
      // other hosts would send another device's domains to the LLM under the
      // selected host's summary. Use bucketsBrowser() rather than an inline
      // filter so the established 'unknown'-hostname fallback is respected: when
      // a browser bucket's hostname is 'unknown' (common in older AW setups),
      // strict equality against this.selectedHost would silently drop it.
      // The fallback is attributed at best to "some device": in multi-device
      // installs those domains may belong to another host. We keep the fallback
      // (dropping it would lose all browser data on older single-device setups)
      // but disclose it explicitly in the context text below, so the user sees
      // exactly what is being sent in the preview before it reaches the LLM.
      const browserBuckets = invocation.browserBuckets;
      // Fallback attribution is captured with the bucket IDs, before the query.
      const browserFallbackUsed = invocation.browserFallbackUsed;

      const end = new Date();
      const start = new Date(end.getTime() - invocation.days * 24 * 60 * 60 * 1000);

      // Query-side AFK filtering and categorization: only derived statistics
      // (never raw titles or URLs) are exported from the result below.
      const query = analysisContextQuery({
        bid_window: windowBucketId,
        bid_afk: invocation.afkBucketId,
        bid_browsers: browserBuckets,
        filter_afk: Boolean(invocation.afkBucketId),
        categories: invocation.categories,
        filter_categories: [],
      });
      const [result] = await getClient().query([{ start, end }], query);

      const context = buildActivityContext({
        events: result.events || [],
        domainEvents: result.browser_domains || [],
        trackedSeconds: result.tracked_duration || 0,
        start,
        end,
        hosts: [invocation.host],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        privacy: {
          excludeUncategorized: invocation.excludeUncategorized,
          privateCategories: invocation.excludePrivateCategories
            ? invocation.privateCategories
            : [],
        },
      });
      const text = formatActivityContext(context);
      if (browserFallbackUsed) {
        return (
          'NOTE: browser data comes from bucket(s) whose hostname could not be ' +
          'resolved ("unknown"), so those domains may belong to a different device.\n' +
          text
        );
      }
      return text;
    },
    async copyResponse() {
      try {
        await navigator.clipboard.writeText(this.llmResponse);
        this.copied = true;
        setTimeout(() => {
          this.copied = false;
        }, 2000);
      } catch {
        this.error = this.$t('ui.aiSummary.copyError');
      }
    },
  },
};
</script>
