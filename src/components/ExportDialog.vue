<template lang="pug">
//- One dialog for every export of Raw Data: a bucket (JSON or CSV), or all buckets (JSON).
b-modal(:visible="visible", :title="title", centered,
        :ok-title="$t('common.export')", :ok-disabled="invalid",
        :cancel-title="$t('common.cancel')",
        @show="reset", @ok="submit", @hidden="$emit('close')")
  input-date-range(:start.sync="from", :end.sync="to")
  b-form-group.mt-3.mb-0(v-if="bucketId", :label="$t('buckets.exportFormat')")
    b-form-radio-group.export-format(v-model="format", :options="formats")
  b-alert.mt-3.mb-0(v-if="invalid", variant="warning", show)
    | {{ $t('ui.timeInterval.invalidRange') }}
</template>

<script lang="ts">
import InputDateRange from '~/components/InputDateRange.vue';

export default {
  name: 'ExportDialog',
  components: { InputDateRange },
  props: {
    visible: { type: Boolean, default: false },
    // The bucket to export; null: all buckets.
    bucketId: { type: String, default: null },
    // The last range used on the page, offered again: YYYY-MM-DD, or ''.
    initialFrom: { type: String, default: '' },
    initialTo: { type: String, default: '' },
  },
  data() {
    return { from: '', to: '', format: 'json' };
  },
  computed: {
    title(): string {
      return this.bucketId
        ? this.$t('buckets.exportBucketTitle', { bucket: this.bucketId })
        : this.$t('buckets.exportAllTitle');
    },
    formats() {
      return [
        { value: 'json', text: 'JSON' },
        { value: 'csv', text: 'CSV' },
      ];
    },
    // Like the Timeline's range: only when both are set and the first is after the second.
    invalid(): boolean {
      return !!this.from && !!this.to && this.from > this.to;
    },
  },
  methods: {
    reset() {
      this.from = this.initialFrom;
      this.to = this.initialTo;
      this.format = 'json';
    },
    submit(event) {
      if (this.invalid) {
        event?.preventDefault?.();
        return;
      }
      // All buckets only exist as JSON on the server.
      const format = this.bucketId ? this.format : 'json';
      this.$emit('export', { format, from: this.from, to: this.to });
    },
  },
};
</script>
