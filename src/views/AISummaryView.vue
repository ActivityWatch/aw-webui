<template lang="pug">
div
  h3.mb-3 AI Activity Summary

  b-alert(variant="info" show)
    | Your API key is stored only in your browser's&nbsp;
    code localStorage
    |  and is sent directly to the LLM provider. ActivityWatch does not receive it.

  div.row.mb-3
    div.col-md-4
      b-form-group(label="Host" label-class="font-weight-bold")
        b-form-select(v-model="selectedHost" :options="hostOptions")

    div.col-md-4
      b-form-group(label="Date Range" label-class="font-weight-bold")
        b-form-select(v-model="dateRange" :options="dateRangeOptions")

    div.col-md-4
      b-form-group(label="LLM Provider" label-class="font-weight-bold")
        b-form-select(v-model="provider" :options="providerOptions" @change="onProviderChange")

  div.row.mb-3
    div.col-md-6
      b-form-group(label="API Key" label-class="font-weight-bold")
        b-form-input(
          v-model="apiKey"
          type="password"
          placeholder="sk-..."
          autocomplete="off"
          @blur="persistConfig"
        )

    div.col-md-3
      b-form-group(label="Model" label-class="font-weight-bold")
        b-form-input(v-model="model" placeholder="e.g. gpt-4o-mini" @blur="persistConfig")

    div.col-md-3(v-if="provider === 'custom'")
      b-form-group(label="Base URL" label-class="font-weight-bold")
        b-form-input(v-model="customBaseUrl" placeholder="https://my-proxy.example.com" @blur="persistConfig")

  div.mb-3
    b-form-group(label="Prompt" label-class="font-weight-bold")
      b-form-textarea(v-model="userPrompt" rows="3" max-rows="8")

  div.mb-4
    b-button(@click="generate" variant="primary" :disabled="loading || !apiKey || !selectedHost")
      b-spinner.mr-2(v-if="loading" small)
      | {{ loading ? 'Generating…' : 'Generate Summary' }}
    b-button.ml-2(
      v-if="aggregatedText"
      variant="outline-secondary"
      @click="dataVisible = !dataVisible"
    ) {{ dataVisible ? 'Hide raw data' : 'Show raw data' }}

  b-alert(v-if="error" variant="danger" show dismissible @dismissed="error = ''")
    | {{ error }}

  div(v-if="dataVisible && aggregatedText")
    b-card.mb-3
      template(slot="header")
        strong Raw activity data sent to LLM
      pre.mb-0(style="white-space: pre-wrap; font-size: 0.85em") {{ aggregatedText }}

  div(v-if="llmResponse")
    b-card
      template(slot="header")
        div.d-flex.justify-content-between.align-items-center
          strong AI Summary
          b-button(size="sm" variant="outline-secondary" @click="copyResponse")
            icon(name="copy")
            |  {{ copied ? 'Copied!' : 'Copy' }}
      div(style="white-space: pre-wrap") {{ llmResponse }}
</template>

<script lang="ts">
import { useBucketsStore } from '~/stores/buckets';
import {
  aggregateEvents,
  buildSummaryText,
  loadLLMConfig,
  saveLLMConfig,
  callLLM,
  type LLMProvider,
} from '~/util/aiSummary';
import 'vue-awesome/icons/copy';

const DEFAULT_PROMPT =
  'Based on the following activity data, provide a concise summary of how I spent my time. ' +
  'Highlight the main activities, identify focus areas, and suggest any observations about productivity patterns.';

export default {
  name: 'AISummaryView',
  data() {
    const saved = loadLLMConfig();
    return {
      bucketsStore: useBucketsStore(),

      selectedHost: '',
      dateRange: 'last7d',
      provider: (saved.provider || 'openai') as LLMProvider,
      apiKey: saved.apiKey || '',
      model: saved.model || '',
      customBaseUrl: saved.baseUrl || '',
      userPrompt: DEFAULT_PROMPT,

      loading: false,
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
        if (b.type === 'currentwindow') {
          hosts.add(b.hostname);
        }
      }
      return Array.from(hosts).map(h => ({ value: h, text: h }));
    },
    dateRangeOptions() {
      return [
        { value: 'last7d', text: 'Last 7 days' },
        { value: 'last30d', text: 'Last 30 days' },
        { value: 'last90d', text: 'Last 90 days' },
      ];
    },
    providerOptions() {
      return [
        { value: 'openai', text: 'OpenAI' },
        { value: 'anthropic', text: 'Anthropic' },
        { value: 'custom', text: 'Custom (OpenAI-compatible)' },
      ];
    },
    periodDays(): number {
      return this.dateRange === 'last7d' ? 7 : this.dateRange === 'last30d' ? 30 : 90;
    },
    defaultModel(): string {
      if (this.provider === 'anthropic') return 'claude-haiku-4-5-20251001';
      return 'gpt-4o-mini';
    },
  },
  async mounted() {
    await this.bucketsStore.ensureLoaded();
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
        baseUrl: this.customBaseUrl,
      });
    },
    async generate() {
      this.error = '';
      this.llmResponse = '';
      this.aggregatedText = '';

      if (!this.selectedHost) {
        this.error = 'No host with a window-watcher bucket found.';
        return;
      }
      if (!this.apiKey.trim()) {
        this.error = 'Please enter your LLM API key.';
        return;
      }

      this.loading = true;
      try {
        const events = await this.fetchEvents();
        const topApps = aggregateEvents(events);
        const totalDuration = topApps.reduce((s, a) => s + a.duration, 0);
        const summaryData = { topApps, totalDuration, periodDays: this.periodDays };
        const summaryText = buildSummaryText(summaryData);

        this.aggregatedText = summaryText;

        const fullPrompt = `${this.userPrompt}\n\n${summaryText}`;
        const effectiveModel = this.model.trim() || this.defaultModel;

        const response = await callLLM(
          {
            provider: this.provider,
            apiKey: this.apiKey.trim(),
            model: effectiveModel,
            baseUrl: this.customBaseUrl,
          },
          fullPrompt
        );
        this.llmResponse = response;
      } catch (err: any) {
        this.error = err?.message || String(err);
      } finally {
        this.loading = false;
      }
    },
    async fetchEvents(): Promise<any[]> {
      const buckets = this.bucketsStore.buckets || [];
      const windowBucket = buckets.find(
        b => b.type === 'currentwindow' && b.hostname === this.selectedHost
      );
      if (!windowBucket) {
        throw new Error(`No window-watcher bucket found for host: ${this.selectedHost}`);
      }

      const end = new Date();
      const start = new Date(end.getTime() - this.periodDays * 24 * 60 * 60 * 1000);

      // Use REST directly for simplicity — aw-client's getEvents signature
      const resp = await fetch(
        `/api/0/buckets/${
          windowBucket.id
        }/events?start=${start.toISOString()}&end=${end.toISOString()}&limit=10000`
      );
      if (!resp.ok) {
        throw new Error(`Failed to fetch events: ${resp.status}`);
      }
      return resp.json();
    },
    async copyResponse() {
      try {
        await navigator.clipboard.writeText(this.llmResponse);
        this.copied = true;
        setTimeout(() => {
          this.copied = false;
        }, 2000);
      } catch {
        this.error = 'Could not copy to clipboard';
      }
    },
  },
};
</script>
