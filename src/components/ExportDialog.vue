<template lang="pug">
//- One dialog for every export of Raw Data: a bucket (JSON or CSV), or all buckets (JSON).
b-modal(:visible="visible", :title="title", centered,
        :ok-title="$t('common.export')", :ok-disabled="invalid || unresolvable || timeWithoutDate",
        :cancel-title="$t('common.cancel')",
        @show="reset", @ok="submit", @hidden="$emit('close')")
  input-date-range(:start.sync="from", :end.sync="to",
                   :start-time.sync="fromTime", :end-time.sync="toTime", :allow-time="allowTime", clearable-start)
  p.small.text-muted.mt-2.mb-0 {{ $t('buckets.exportRangeHelp') }}
  b-form-group.mt-3.mb-0(v-if="bucketId", :label="$t('buckets.exportFormat')")
    b-form-radio-group.export-format(v-model="format", :options="formats")
  b-alert.mt-3.mb-0(v-if="invalid", variant="warning", show)
    | {{ $t('ui.timeInterval.invalidRange') }}
  b-alert.mt-3.mb-0(v-if="unresolvable", variant="warning", show)
    | {{ $t('ui.timeInterval.unresolvableTime') }}
  b-alert.mt-3.mb-0(v-if="timeWithoutDate", variant="warning", show)
    | {{ $t('buckets.exportTimeNeedsDate') }}
</template>

<script lang="ts">
import InputDateRange from '~/components/InputDateRange.vue';
import { ExportRange, exportRangeBounds } from '~/util/export';

export default {
  name: 'ExportDialog',
  components: { InputDateRange },
  props: {
    visible: { type: Boolean, default: false },
    // The bucket to export; null: all buckets.
    bucketId: { type: String, default: null },
    // The last range used on the page, offered again: YYYY-MM-DD and HH:mm, or ''.
    initialFrom: { type: String, default: '' },
    initialTo: { type: String, default: '' },
    initialFromTime: { type: String, default: '' },
    initialToTime: { type: String, default: '' },
  },
  data() {
    return { from: '', to: '', fromTime: '', toTime: '', format: 'json' };
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
    // Exact times for the CSV export of a bucket; JSON exports take whole days.
    allowTime(): boolean {
      return !!this.bucketId && this.format === 'csv';
    },
    range(): ExportRange {
      return {
        from: this.from || '',
        to: this.to || '',
        fromTime: this.allowTime ? this.fromTime || '' : '',
        toTime: this.allowTime ? this.toTime || '' : '',
      };
    },
    bounds() {
      return exportRangeBounds(this.range);
    },
    // A wall time that does not exist or happens twice (DST): never silently pick one.
    unresolvable(): boolean {
      return this.bounds === undefined;
    },
    // A time with no date to apply to would be ignored, exporting more than asked for.
    timeWithoutDate(): boolean {
      const { from, to, fromTime, toTime } = this.range;
      // An end time without an end date refers to the start date.
      return (!!fromTime && !from) || (!!toTime && !to && !from);
    },
    // Like the Timeline's range: only when both sides are set and the start is not before the end.
    invalid(): boolean {
      const b = this.bounds;
      return !!b && !!b.start && !!b.end && b.start >= b.end;
    },
  },
  watch: {
    format() {
      this.showEndTimeDay();
    },
  },
  methods: {
    reset() {
      this.from = this.initialFrom;
      this.to = this.initialTo;
      this.fromTime = this.initialFromTime;
      this.toTime = this.initialToTime;
      this.format = 'json';
      this.showEndTimeDay();
    },
    // JSON hides the times, so the day of an end time without an end date (the start
    // date) moves into the end date field, where it can be seen and cleared.
    showEndTimeDay() {
      if (this.format === 'json' && this.toTime && !this.to) this.to = this.from;
    },
    submit(event) {
      if (this.invalid || this.unresolvable || this.timeWithoutDate) {
        event?.preventDefault?.();
        return;
      }
      // All buckets only exist as JSON on the server.
      const format = this.bucketId ? this.format : 'json';
      this.$emit('export', { format, ...this.range });
    },
  },
};
</script>
