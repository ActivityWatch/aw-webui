<template lang="pug">
b-modal(:id="modalId", ref="modal", :title="$t('extraViews.search.editStoredTitle')", size="xl", hide-footer, @hidden="reset")
  p.small.text-muted {{ $t('extraViews.search.editStoredHelp') }}

  div.form-row
    div.col-md-4
      label.small {{ $t('ui.eventEditor.bucket') }}
      b-form-select(v-model="bucketId", :options="sources", size="sm")
    div.col-md-3
      label.small {{ $t('ui.eventEditor.start') }}
      b-input(v-model="start", type="datetime-local", size="sm")
    div.col-md-3
      label.small {{ $t('ui.eventEditor.end') }}
      b-input(v-model="end", type="datetime-local", size="sm")
    div.col-md-2.d-flex.align-items-end
      b-button(size="sm", variant="primary", :disabled="!bucketId || loading", @click="load()") {{ $t('extraViews.search.load') }}

  b-form-checkbox.mt-2(v-model="onlyMatching", size="sm")
    | {{ $t('extraViews.search.onlyMatching') }}

  b-alert.mt-2(v-if="error", show, variant="danger") {{ error }}
  b-alert.mt-2(v-if="outOfRange", show, variant="warning") {{ $t('extraViews.search.outOfRange') }}
  b-alert.mt-2(v-if="truncated", show, variant="warning") {{ $t('extraViews.search.truncated') }}

  div.mt-2(v-if="loading") #[icon(name="spinner" pulse)]
  div.mt-2(v-else-if="candidates")
    p.small.text-muted(v-if="shown.length === 0") {{ $t('extraViews.search.noCandidates') }}
    table.table.table-sm.table-hover(v-else)
      thead
        tr
          th ID
          th {{ $t('extraViews.search.timestamp') }}
          th {{ $t('extraViews.search.duration') }}
          th {{ $t('extraViews.search.data') }}
          th
      tbody
        tr(v-for="e in shown", :key="e.id")
          td {{ e.id }}
          td {{ e.timestamp | shortdate }} {{ e.timestamp | shorttime }}
          td {{ e.duration | friendlyduration }}
          td.small(style="word-break: break-all") {{ summarize(e) }}
          td
            b-button(size="sm", variant="outline-dark", @click="select(e)") {{ $t('ui.eventEditor.editTitle') }}
</template>

<script lang="ts">
import moment from 'moment';
import 'vue-awesome/icons/spinner';

// Format accepted by <input type="datetime-local">.
const LOCAL = 'YYYY-MM-DDTHH:mm';

export default {
  name: 'aw-search-source-selector',
  props: {
    // The submitted search this selector browses: { pattern, start, stop, sources: [bucketId] }.
    search: { type: Object, required: true },
    modalId: { type: String, default: 'search-source-selector' },
    limit: { type: Number, default: 500 },
  },
  data() {
    return {
      bucketId: null,
      start: '',
      end: '',
      onlyMatching: true,
      candidates: null,
      loading: false,
      error: '',
      outOfRange: false,
      loadSequence: 0,
    };
  },
  computed: {
    sources() {
      return this.search.sources;
    },
    pattern() {
      return this.search.pattern;
    },
    truncated() {
      return this.candidates !== null && this.candidates.length >= this.limit;
    },
    shown() {
      if (!this.candidates) return [];
      if (!this.onlyMatching) return this.candidates;
      let re;
      try {
        re = new RegExp(this.pattern, 'i');
      } catch (e) {
        return this.candidates;
      }
      return this.candidates.filter(e =>
        Object.values(e.data || {}).some(v => typeof v === 'string' && re.test(v))
      );
    },
  },
  watch: {
    search() {
      // A new or refreshed search invalidates any listed candidates.
      this.invalidate();
    },
    // A list (or pending load) belongs to the inputs it was requested with;
    // changing them must not leave another bucket's events editable below.
    bucketId() {
      this.invalidate();
    },
    start() {
      this.invalidate();
    },
    end() {
      this.invalidate();
    },
  },
  beforeDestroy() {
    this.loadSequence++;
  },
  methods: {
    open(bucketId) {
      this.bucketId = bucketId || this.sources[0] || null;
      this.start = moment(this.search.start).format(LOCAL);
      this.end = moment(this.search.stop).format(LOCAL);
      this.invalidate();
      this.$bvModal.show(this.modalId);
    },
    reset() {
      this.invalidate();
    },
    invalidate() {
      this.loadSequence++;
      this.candidates = null;
      this.loading = false;
      this.error = '';
      this.outOfRange = false;
    },
    async load() {
      const sequence = ++this.loadSequence;
      const bucketId = this.bucketId;
      const start = moment(this.start);
      const end = moment(this.end);
      this.candidates = null;
      this.error = '';
      this.outOfRange =
        !start.isValid() ||
        !end.isValid() ||
        start.isBefore(moment(this.search.start)) ||
        end.isAfter(moment(this.search.stop)) ||
        !start.isBefore(end);
      if (this.outOfRange || !bucketId) return;
      this.loading = true;
      try {
        const events = await this.$aw.getEvents(bucketId, {
          start: start.toDate(),
          end: end.toDate(),
          limit: this.limit,
        });
        if (sequence !== this.loadSequence) return;
        // Attach the bucket at receipt: the editor addresses /buckets/{bucket}/events/{id}.
        this.candidates = events.filter(e => e.id != null).map(e => ({ ...e, bucketId }));
      } catch (e) {
        if (sequence !== this.loadSequence) return;
        this.error = e.response?.data?.message ?? String(e);
      } finally {
        if (sequence === this.loadSequence) this.loading = false;
      }
    },
    select(event) {
      this.$bvModal.hide(this.modalId);
      this.$emit('select', { bucketId: event.bucketId, event: { id: event.id, data: event.data } });
    },
    summarize(e) {
      return Object.entries(e.data || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join(' · ');
    },
  },
};
</script>
