<template lang="pug">
div
  div
    table
      tr
        td.pr-2
          label(for="mode") Interval mode:
        td
          select(id="mode" v-model="mode")
            option(value='last_duration') Last duration
            option(value='range') Date range
      tr(v-if="mode == 'last_duration'")
        td.pr-2
          label(for="duration") Show last:
        td
          select(id="duration" :value="duration", @change="valueChanged")
            option(:value="15*60") 15min
            option(:value="60*60") 1h
            option(:value="6*60*60") 6h
            option(:value="24*60*60") 24h
      tr(v-if="mode == 'range'")
        td.pr-2 Range:
        td
          input(type="date", v-model="start", @input="valueChanged")
          input(type="date", v-model="end", @input="valueChanged")

</template>

<style scoped lang="scss">
</style>

<script>
import moment from 'moment';

export default {
  name: "input-timeinterval",
  data: () => {
    return {
      now: moment(),
      mode: 'last_duration',
      duration: 60 * 60,
      start: null,
      end: null,
    }
  },
  computed: {
    value: {
      get() {
        if(this.mode == 'range' && this.start && this.end) {
          return [moment(this.start), moment(this.end)];
        } else {
          return [
            moment(this.now).subtract(this.duration, "seconds"),
            moment(this.now)
          ];
        }
      },
      set(newValue) {
        if(!isNaN(newValue)) {
          this.customRange = null;
          this.duration = newValue;
        } else {
          this.customRange = newValue;
        }
      }
    }
  },
  methods: {
    valueChanged(e) {
      this.value = e.target.value;
      this.$emit('input', this.value);
    }
  }
}
</script>
