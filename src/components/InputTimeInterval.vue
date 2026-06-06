<template lang="pug">
div
  div
    b-alert(v-if="invalidDaterange", variant="warning", show)
      | The selected date range is invalid. The second date must be greater or equal to the first date.
    b-alert(v-if="daterangeTooLong", variant="warning", show)
      | The selected date range is too long. The maximum is {{ maxDuration/(24*60*60) }} days.

  div.input-time-interval.d-flex.flex-wrap.align-items-start.justify-content-between
    // Two-row grid: labels share a fixed-width column so the Mode toggle
    // and the Range controls line up vertically and the secondary label
    // stays in the same spot (just "Range") regardless of which mode is
    // active. Previously the label flipped between "Quick range" / "Range"
    // and the inputs shifted horizontally on every toggle.
    div.time-interval-grid
      label.col-form-label.col-form-label-sm.mb-0(for="time-mode") Mode
      b-form-radio-group#time-mode(
        v-model="mode",
        @change="valueChanged",
        buttons,
        button-variant="outline-secondary",
        size="sm",
        :options="modeOptions"
      )

      label.col-form-label.col-form-label-sm.mb-0 Range
      div.d-flex.flex-wrap.align-items-center(v-if="mode == 'last_duration'")
        div.btn-group(role="group" aria-label="Quick durations")
          template(v-for="(dur, idx) in durations")
            input(
              type="radio"
              :id="'dur' + idx"
              :value="dur.seconds"
              v-model="duration"
              @change="applyLastDuration"
            ).d-none
            label(:for="'dur' + idx" v-html="dur.label").btn.btn-light.btn-sm
      div.d-flex.flex-wrap.align-items-center(v-else)
        input.form-control.form-control-sm.mr-1(
          type="date", v-model="start", :max="end || undefined", style="width: auto"
          aria-label="Start date"
        )
        input.form-control.form-control-sm.mr-1(
          type="date", v-model="end", :min="start || undefined", placeholder="(optional)", style="width: auto"
          aria-label="End date (optional)"
        )
        b-button(
          size="sm" variant="outline-dark"
          :disabled="invalidDaterange || emptyDaterange || daterangeTooLong"
          @click="applyRange"
        ) Apply

    div.text-right.d-none.d-md-block(v-if="showUpdate")
      b-button.px-2(@click="refresh()", variant="outline-dark", size="sm")
        icon.mr-1(name="sync")
        span.d-none.d-md-inline
          | Refresh
      div.mt-2.small.text-muted(v-if="lastUpdate")
        | Last update: #[time(:datetime="lastUpdate.format()") {{lastUpdate | friendlytime}}]
</template>

<style scoped lang="scss">
.input-time-interval {
  row-gap: 0.5rem;
}

.time-interval-grid {
  display: grid;
  // Fixed label column keeps Mode/Range labels aligned and the controls
  // start at the same X regardless of which mode is active.
  grid-template-columns: 4rem 1fr;
  column-gap: 0.75rem;
  row-gap: 0.5rem;
  align-items: center;
}

.btn-group {
  input[type='radio']:checked + label {
    background-color: #495057;
    color: #fff;
    border-color: #495057;
  }
}
</style>

<script lang="ts">
import moment from 'moment';
import 'vue-awesome/icons/sync';
export default {
  name: 'input-timeinterval',
  props: {
    defaultDuration: {
      type: Number,
      default: 60 * 60,
    },
    maxDuration: {
      type: Number,
      default: null,
    },
    showUpdate: {
      type: Boolean,
      default: true,
    },
  },
  data() {
    return {
      duration: null,
      mode: 'last_duration',
      start: null,
      end: null,
      lastUpdate: null,
      durations: [
        { seconds: 0.25 * 60 * 60, label: '&frac14;h' },
        { seconds: 0.5 * 60 * 60, label: '&frac12;h' },
        { seconds: 60 * 60, label: '1h' },
        { seconds: 2 * 60 * 60, label: '2h' },
        { seconds: 3 * 60 * 60, label: '3h' },
        { seconds: 4 * 60 * 60, label: '4h' },
        { seconds: 6 * 60 * 60, label: '6h' },
        { seconds: 12 * 60 * 60, label: '12h' },
        { seconds: 24 * 60 * 60, label: '24h' },
        { seconds: 48 * 60 * 60, label: '48h' },
      ],
      modeOptions: [
        { text: 'Last duration', value: 'last_duration' },
        { text: 'Date range', value: 'range' },
      ],
    };
  },
  computed: {
    value: {
      get() {
        if (this.mode == 'range' && this.start) {
          const startDate = moment(this.start);
          // If only start date is set, show that single day
          const endDate = this.end
            ? moment(this.end).add(1, 'day')
            : startDate.clone().add(1, 'day');
          return [startDate, endDate];
        } else {
          return [moment().subtract(this.duration, 'seconds'), moment()];
        }
      },
    },
    emptyDaterange() {
      return !this.start;
    },
    invalidDaterange() {
      if (!this.end) return false;
      return moment(this.start) > moment(this.end);
    },
    daterangeTooLong() {
      if (!this.end) return false;
      return moment(this.start).add(this.maxDuration, 'seconds').isBefore(moment(this.end));
    },
  },
  mounted() {
    this.duration = this.defaultDuration;
    this.valueChanged();

    // We want our lastUpdated text to update every ~500ms
    // We can do this by setting it to null and then the previous value.
    this.lastUpdateTimer = setInterval(() => {
      const _lastUpdate = this.lastUpdate;
      this.lastUpdate = null;
      this.lastUpdate = _lastUpdate;
    }, 500);
  },
  beforeDestroy() {
    clearInterval(this.lastUpdateTimer);
  },
  methods: {
    valueChanged() {
      if (
        this.mode == 'last_duration' ||
        (!this.emptyDaterange && !this.invalidDaterange && !this.daterangeTooLong)
      ) {
        this.lastUpdate = moment();
        this.$emit('input', this.value);
      }
    },
    refresh() {
      const tmpMode = this.mode;
      this.mode = '';
      this.mode = tmpMode;
      this.valueChanged();
    },
    applyRange() {
      this.mode = 'range';
      this.duration = 0;
      this.valueChanged();
    },
    applyLastDuration() {
      this.mode = 'last_duration';
      this.valueChanged();
    },
  },
};
</script>
