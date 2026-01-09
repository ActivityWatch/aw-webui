<template lang="pug">
div
  b-row
    b-col(cols="12", md="6").mb-2
      b-form-group(label="Watcher (bucket)")
        b-form-select(
          v-model="selectedBucketId",
          :options="bucketOptions",
          :disabled="bucketOptions.length === 0 || loading"
        )
    b-col(cols="12", md="6").mb-2
      b-form-group
        template(#label)
          span Field in event data
          span.info-icon(
            title="Field names come from event data. Dot notation is supported (e.g., data.title)."
          ) i
        b-form-select(
          v-model="selectedField",
          :options="fieldSelectOptions",
          :disabled="!selectedBucketId || loading"
        )
        b-form-input.mt-2(
          v-if="selectedField === '__custom' || fieldOptions.length === 0",
          v-model="customField",
          placeholder="e.g. data.title",
          :disabled="loading"
        )
  b-alert.mt-2(v-if="error", show, variant="danger") {{ error }}
  b-alert.mt-2(v-else-if="!selectedBucketId" show variant="info")
    | Select a watcher to load events for this period.
  b-alert.mt-2(v-else-if="!loading && aggregated.length === 0" show variant="warning")
    | No events found for this watcher and time range.

  div.mt-2
    div.text-center.py-4(v-if="loading")
      b-spinner(small type="grow" label="Loading")
      span.ml-2 Loading events...
    aw-summary(
      v-else-if="aggregated.length",
      :fields="aggregated",
      :namefunc="namefunc",
      :hoverfunc="hoverfunc",
      :colorfunc="colorfunc",
      with_limit
    )
    div.text-muted.text-center.py-4(v-else)
      | Pick a field to see results.
</template>

<script lang="ts">
import _ from 'lodash';
import moment from 'moment';
import { useActivityStore } from '~/stores/activity';
import { useBucketsStore } from '~/stores/buckets';
import { getClient } from '~/util/awclient';
interface AggregatedEvent {
  duration: number;
  data: Record<string, any>;
}
function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(' > ');
  if (value === null || value === undefined) return 'Unknown';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
export default {
  name: 'aw-watcher-columns',
  props: {
    initialBucketId: { type: String, default: '' },
    initialField: { type: String, default: '' },
    initialCustomField: { type: String, default: '' },
  },
  data() {
    return {
      bucketsStore: useBucketsStore(),
      activityStore: useActivityStore(),
      selectedBucketId: this.initialBucketId || '',
      selectedField: this.initialField || '',
      customField: this.initialCustomField || '',
      fieldOptions: [] as string[],
      events: [] as any[],
      aggregated: [] as AggregatedEvent[],
      loading: false,
      error: '',
    };
  },
  computed: {
    bucketOptions(): { value: string; text: string }[] {
      return this.bucketsStore.buckets.map(b => ({
        value: b.id,
        text: `${b.id} (${b.type || 'unknown'})`,
      }));
    },
    fieldSelectOptions(): { value: string; text: string }[] {
      const options = this.fieldOptions.map(f => ({ value: f, text: f }));
      options.push({ value: '__custom', text: 'Custom field…' });
      return options;
    },
    selectedFieldValue(): string {
      if (this.selectedField === '__custom') return this.customField;
      return this.selectedField;
    },
    timeRange(): { start: string; end: string } | null {
      const opts = this.activityStore.query_options;
      if (!opts || !opts.timeperiod) return null;
      const start = opts.timeperiod.start;
      const end = moment(start)
        .add(...opts.timeperiod.length)
        .toISOString();
      return { start, end };
    },
    namefunc(): (e: AggregatedEvent) => string {
      return e => e.data.display;
    },
    hoverfunc(): (e: AggregatedEvent) => string {
      return e => e.data.display;
    },
    colorfunc(): (e: AggregatedEvent) => string {
      return e => e.data.colorKey;
    },
  },
  watch: {
    selectedBucketId: function () {
      this.emitSelection();
      this.loadEvents();
    },
    selectedField: function () {
      this.emitSelection();
      this.aggregate();
    },
    customField: function () {
      if (this.selectedField === '__custom') {
        this.emitSelection();
        this.aggregate();
      }
    },
    timeRange() {
      this.loadEvents();
    },
  },
  async mounted() {
    await this.bucketsStore.ensureLoaded();
    this.setDefaultBucket();
    this.emitSelection();
    if (this.selectedBucketId) {
      await this.loadEvents();
    }
  },
  methods: {
    setDefaultBucket() {
      if (this.selectedBucketId) return;
      const host = this.activityStore.query_options && this.activityStore.query_options.host;
      const byHost = host ? this.bucketsStore.buckets.filter(b => b.hostname === host) : [];
      if (byHost.length > 0) {
        this.selectedBucketId = byHost[0].id;
      } else if (this.bucketsStore.buckets.length > 0) {
        this.selectedBucketId = this.bucketsStore.buckets[0].id;
      }
    },
    async loadEvents() {
      if (!this.selectedBucketId || !this.timeRange) return;
      this.loading = true;
      this.error = '';
      this.aggregated = [];
      try {
        this.events = await getClient().getEvents(this.selectedBucketId, {
          start: this.timeRange.start,
          end: this.timeRange.end,
          limit: -1,
        });
        this.fieldOptions = this.extractFields(this.events);
        if (!this.selectedField && this.fieldOptions.length > 0) {
          this.selectedField = this.fieldOptions[0];
        } else if (!this.selectedField && this.fieldOptions.length === 0) {
          this.selectedField = '__custom';
        }
        this.aggregate();
      } catch (err) {
        console.error(err);
        this.events = [];
        this.fieldOptions = [];
        this.error = err?.message || 'Failed to load events for the selected watcher.';
      } finally {
        this.loading = false;
      }
    },
    extractFields(events: any[]): string[] {
      const keys = new Set<string>();
      events.slice(0, 50).forEach(e => {
        Object.keys(e.data || {}).forEach(k => keys.add(k));
      });
      return Array.from(keys).sort();
    },
    aggregate() {
      const fieldValue = (this.selectedFieldValue || '').trim();
      if (!fieldValue) {
        this.aggregated = [];
        return;
      }
      const path = fieldValue.startsWith('data.') ? fieldValue : `data.${fieldValue}`;
      const grouped = new Map<string, AggregatedEvent>();
      this.events.forEach(e => {
        const value = _.get(e, path);
        const display = formatValue(value);
        const key = Array.isArray(value) ? JSON.stringify(value) : String(display);
        if (!grouped.has(key)) {
          grouped.set(key, {
            duration: 0,
            data: { display, raw: value, colorKey: display },
          });
        }
        const entry = grouped.get(key)!;
        entry.duration += e.duration || 0;
      });
      this.aggregated = Array.from(grouped.values()).sort((a, b) => b.duration - a.duration);
    },
    emitSelection() {
      this.$emit('update-props', {
        bucketId: this.selectedBucketId,
        field: this.selectedField === '__custom' ? '__custom' : this.selectedField,
        customField: this.selectedField === '__custom' ? this.customField : '',
      });
    },
  },
};
</script>

<style scoped>
.info-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.25rem;
  width: 1.15em;
  height: 1.15em;
  border: 1px solid #888;
  border-radius: 50%;
  font-size: 0.75em;
  color: #555;
  cursor: help;
}
</style>
