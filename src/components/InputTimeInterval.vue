<template lang="pug">
div
  div
    b-alert(v-if="mode == 'range' && invalidDaterange", variant="warning", show)
      | The selected date range is invalid. The second date must be greater than the first date.
    b-alert(v-if="mode == 'range' && daterangeTooLong", variant="warning", show)
      | The selected date range is too long. The maximum is {{ maxDuration/(24*60*60) }} days.

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

</template>

<style scoped lang="scss"></style>

<script>
import moment from 'moment';
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
  },
  data() {
    return {
      duration: JSON.parse(JSON.stringify(this.defaultDuration)), // Make a copy of defaultDuration
      mode: 'last_duration',
      start: null,
      end: null,
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
    this.valueChanged();
  },
  methods: {
    valueChanged() {
      if (
        this.mode == 'last_duration' ||
        (!this.emptyDaterange && !this.invalidDaterange && !this.daterangeTooLong)
      ) {
        this.$emit('input', this.value);
      }
    },
  },
};
</script>
