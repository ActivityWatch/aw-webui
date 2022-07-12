<template lang="pug">
div
  div
    b-alert(v-if="mode == 'range' && invalidDaterange", variant="warning", show)
      | The selected date range is invalid. The second date must be greater than the first date.
    b-alert(v-if="mode == 'range' && daterangeTooLong", variant="warning", show)
      | The selected date range is too long. The maximum is {{ maxDuration/(24*60*60) }} days.

  div.d-flex.justify-content-between.align-items-end
    table
      tr
        th.pr-2
          label(for="mode") Interval mode:
        td
          select(id="mode", v-model="mode")
            option(value='last_duration') Last duration
            option(value='range') Date range
      tr(v-if="mode == 'last_duration'")
        th.pr-2
          label(for="duration") Show last:
        td
          select(id="duration", v-model="duration", @change="valueChanged")
            option(:value="15*60") 15min
            option(:value="30*60") 30min
            option(:value="60*60") 1h
            option(:value="2*60*60") 2h
            option(:value="4*60*60") 4h
            option(:value="6*60*60") 6h
            option(:value="12*60*60") 12h
            option(:value="24*60*60") 24h
      tr(v-if="mode == 'range'")
        th.pr-2 Range:
        td
          input(type="date", v-model="start")
          input(type="date", v-model="end")
          button(
            class="btn btn-outline-dark btn-sm",
            type="button",
            :disabled="mode == 'range' && (invalidDaterange || emptyDaterange || daterangeTooLong)",
            @click="valueChanged"
          ) Update

    div(style="text-align:right" v-if="showUpdate && mode=='last_duration'")
      b-button.px-2(@click="update()", variant="outline-dark", size="sm")
        icon(name="sync")
        span.d-none.d-md-inline
          |  Update
      div.mt-1.small.text-muted(v-if="lastUpdate")
        | Last update: #[time(:datetime="lastUpdate.format()") {{lastUpdate | friendlytime}}]
</template>

<style scoped lang="scss"></style>

<script>
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
    };
  },
  computed: {
    value: {
      get() {
        if (this.mode == 'range' && this.start && this.end) {
          return [moment(this.start), moment(this.end)];
        } else {
          return [moment().subtract(this.duration, 'seconds'), moment()];
        }
      },
    },
    emptyDaterange() {
      return !(this.start && this.end);
    },
    invalidDaterange() {
      return moment(this.start) >= moment(this.end);
    },
    daterangeTooLong() {
      return moment(this.start).add(this.maxDuration, 'seconds').isBefore(moment(this.end));
    },
  },
  mounted() {
    this.duration = this.defaultDuration;
    this.valueChanged();

    // We want our lastUpdated text to update every ~3s
    // We can do this by setting it to null and then the previous value.
    this.lastUpdateTimer = setInterval(() => {
      const _lastUpdate = this.lastUpdate;
      this.lastUpdate = null;
      this.lastUpdate = _lastUpdate;
    }, 1000);
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
    update() {
      if (this.mode == 'last_duration') {
        this.mode = ''; // remove cache on v-model, see explanation: https://github.com/ActivityWatch/aw-webui/pull/344/files#r892982094
        this.mode = 'last_duration';
        this.valueChanged();
      }
    },
  },
};
</script>
