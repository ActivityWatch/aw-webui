<template lang="pug">
div
  div
    b-alert(v-if="invalidDaterange", variant="warning", show)
      | {{ $t('ui.timeInterval.invalidRange') }}
    b-alert(v-if="unresolvableTime", variant="warning", show)
      | {{ $t('ui.timeInterval.unresolvableTime') }}
    b-alert(v-if="daterangeTooLong", variant="warning", show)
      | {{ $t('ui.timeInterval.tooLong', { days: maxDuration/(24*60*60) }) }}

  div.input-time-interval.d-flex.flex-wrap.align-items-start.justify-content-between
    // Two-row grid: labels share a fixed-width column so the Mode toggle
    // and the Range controls line up vertically and the secondary label
    // stays in the same spot (just "Range") regardless of which mode is
    // active. Previously the label flipped between "Quick range" / "Range"
    // and the inputs shifted horizontally on every toggle.
    div.time-interval-grid
      label.col-form-label.col-form-label-sm.mb-0(for="time-mode") {{ $t('ui.timeInterval.mode') }}
      b-form-radio-group#time-mode(
        v-model="mode",
        @change="valueChanged",
        buttons,
        button-variant="outline-secondary",
        size="sm",
        :options="modeOptions"
      )

      label.col-form-label.col-form-label-sm.mb-0 {{ $t('ui.timeInterval.range') }}
      div.d-flex.flex-wrap.align-items-center(v-if="mode == 'last_duration'")
        div.btn-group(role="group" :aria-label="$t('ui.timeInterval.quickDurations')")
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
          :aria-label="$t('ui.timeInterval.startDate')"
        )
        input.form-control.form-control-sm.mr-1(
          v-if="allowTime", type="time", v-model="startTime", style="width: auto"
          :aria-label="$t('ui.timeInterval.startTime')"
        )
        input.form-control.form-control-sm.mr-1(
          type="date", v-model="end", :min="start || undefined", :placeholder="$t('ui.timeInterval.optional')", style="width: auto"
          :aria-label="$t('ui.timeInterval.endDate')"
        )
        input.form-control.form-control-sm.mr-1(
          v-if="allowTime", type="time", v-model="endTime", style="width: auto"
          :aria-label="$t('ui.timeInterval.endTime')"
        )
        b-button(
          size="sm" variant="outline-dark"
          :disabled="invalidDaterange || emptyDaterange || daterangeTooLong || unresolvableTime"
          @click="applyRange"
        ) {{ $t('ui.timeInterval.apply') }}

      template(v-if="mode === 'range'")
        label.col-form-label.col-form-label-sm.mb-0 Shift
        div.btn-group(role="group" aria-label="Shift date range")
          input.btn.btn-light.btn-sm(
            type="button" value="-1w"
            @click="shiftDays(-7); $event.target.blur()"
            aria-label="Shift back one week"
          )
          input.btn.btn-light.btn-sm(
            type="button" value="-1d"
            @click="shiftDays(-1); $event.target.blur()"
            aria-label="Shift back one day"
          )
          input.btn.btn-light.btn-sm(
            type="button" value="Today"
            @click="setToday(); $event.target.blur()"
            aria-label="Jump to today"
          )
          input.btn.btn-light.btn-sm(
            type="button" value="+1d"
            @click="shiftDays(1); $event.target.blur()"
            aria-label="Shift forward one day"
          )
          input.btn.btn-light.btn-sm(
            type="button" value="+1w"
            @click="shiftDays(7); $event.target.blur()"
            aria-label="Shift forward one week"
          )

    div.text-right.d-none.d-md-block(v-if="showUpdate")
      b-button.px-2(@click="refresh()", variant="outline-dark", size="sm")
        icon.mr-1(name="sync")
        span.d-none.d-md-inline
          | {{ $t('ui.timeInterval.refresh') }}
      div.mt-2.small.text-muted(v-if="lastUpdate")
        | {{ $t('ui.timeInterval.lastUpdate') }}: #[time(:datetime="lastUpdate.format()") {{lastUpdate | friendlytime}}]
</template>

<style scoped lang="scss">
.input-time-interval {
  row-gap: 0.5rem;
}

.time-interval-grid {
  display: grid;
  // Fixed label column keeps Mode/Range labels aligned and the controls
  // start at the same X regardless of which mode is active.
  grid-template-columns: 4rem minmax(0, 1fr);
  column-gap: 0.75rem;
  row-gap: 0.5rem;
  align-items: center;
  min-width: 0;
}

.btn-group {
  input[type='radio']:checked + label {
    background-color: #495057;
    color: #fff;
    border-color: #495057;
  }
}

@media (max-width: 575.98px) {
  .time-interval-grid {
    grid-template-columns: 1fr;
  }

  .btn-group {
    flex-wrap: wrap;
  }
}
</style>

<script lang="ts">
import moment from 'moment';
import { wallTimeInstants } from '~/util/timeperiod';
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
    // Optional time inputs next to the dates, for consumers that need exact
    // sub-day bounds. Off by default so date-only callers are unchanged.
    allowTime: {
      type: Boolean,
      default: false,
    },
  },
  data() {
    return {
      duration: null,
      mode: 'last_duration',
      start: null,
      end: null,
      startTime: null,
      endTime: null,
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
    };
  },
  computed: {
    modeOptions() {
      return [
        { text: this.$t('ui.timeInterval.lastDuration'), value: 'last_duration' },
        { text: this.$t('ui.timeInterval.dateRange'), value: 'range' },
      ];
    },
    // Optional time inputs make the range exact. Without them the date inputs
    // keep their inclusive-day semantics exactly as before.
    hasTime() {
      return this.allowTime && !!(this.startTime || this.endTime);
    },
    rangeStart() {
      if (!this.start) return null;
      return this.hasTime ? this.wallInstant(this.start, this.startTime) : moment(this.start);
    },
    rangeEnd() {
      if (!this.start) return null;
      // A single date with no end date is one day long, whatever the start time.
      if (!this.end) return moment(this.start).add(1, 'day');
      // No end time keeps the end date inclusive, like the date-only inputs.
      if (!this.hasTime) return moment(this.end).add(1, 'day');
      return this.wallInstant(this.end, this.endTime);
    },
    // A wall time that does not exist (spring-forward gap) or happens twice
    // (fall-back) cannot name an exact interval, and we never silently pick one.
    unresolvableTime() {
      if (!this.hasTime) return false;
      return this.rangeStart === null || this.rangeEnd === null;
    },
    dateRange() {
      const start = this.rangeStart;
      const end = this.rangeEnd;
      if (start !== null && end !== null) return [start, end];
      // Unresolvable wall time: still emit the date-only range so consumers
      // never receive null. Apply stays disabled while this holds.
      const startDate = moment(this.start);
      return [
        startDate,
        this.end ? moment(this.end).add(1, 'day') : startDate.clone().add(1, 'day'),
      ];
    },
    value: {
      get() {
        if (this.mode == 'range' && this.start) {
          return this.dateRange;
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
      if (!this.hasTime) return moment(this.start) > moment(this.end);
      const start = this.rangeStart;
      const end = this.rangeEnd;
      // Reported separately by unresolvableTime.
      if (start === null || end === null) return false;
      return !start.isBefore(end);
    },
    daterangeTooLong() {
      if (!this.start || this.maxDuration === null) return false;
      const [start, end] = this.dateRange;
      // maxDuration is elapsed seconds, not calendar days (which vary across DST).
      return end.diff(start, 'seconds', true) > this.maxDuration;
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
    // Resolve a local wall time (date plus optional time) to one instant.
    wallInstant(date: string, time: string | null) {
      const instants = wallTimeInstants(`${date}T${time || '00:00'}`);
      return instants.length === 1 ? moment(instants[0]) : null;
    },
    valueChanged() {
      if (
        this.mode == 'last_duration' ||
        (!this.emptyDaterange &&
          !this.invalidDaterange &&
          !this.daterangeTooLong &&
          !this.unresolvableTime)
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
      this.valueChanged();
    },
    applyLastDuration() {
      this.mode = 'last_duration';
      this.valueChanged();
    },
    setToday() {
      const today = moment().format('YYYY-MM-DD');
      this.start = today;
      this.end = today;
      this.mode = 'range';
      this.valueChanged();
    },
    shiftDays(days: number) {
      if (!this.start) return;
      const newStart = moment(this.start).add(days, 'days').format('YYYY-MM-DD');
      const newEnd = this.end ? moment(this.end).add(days, 'days').format('YYYY-MM-DD') : null;
      this.start = newStart;
      this.end = newEnd;
      this.mode = 'range';
      this.valueChanged();
    },
  },
};
</script>
