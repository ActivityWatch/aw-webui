<template lang="pug">
div
  div
    div(class="settings-bar")
      div
        label(for="mode") Interval mode:
        select(id="mode" v-model="mode")
          option(value='last_duration') Last duration
          option(value='range') Date range
      div(v-if="mode == 'last_duration'")
        label(for="duration") Show last:
        select(id="duration" :value="duration" @change="changeDuration")
          option(:value="15*60") 15min
          option(:value="30*60") 30min
          option(:value="60*60") 1h
          option(:value="2*60*60") 2h
          option(:value="4*60*60") 4h
          option(:value="6*60*60") 6h
          option(:value="12*60*60") 12h
          option(:value="24*60*60") 24h
      div(v-if="mode == 'range'")
        | Range:
        input(type="date", v-model="start")
        input(type="date", v-model="end")
      div
        button.btn.btn-outline-dark(
          type="button", 
          :disabled="invalidDaterange || emptyDaterange",
          @click="showTimeline"
        ) Show Timeline
    div(:style="{ color: 'red', visibility: invalidDaterange ? 'visible' : 'hidden' }")
      | The selected date range is invalid.

</template>

<style scoped lang="scss">
.settings-bar {
  display: flex;
  justify-content: space-between;
}
</style>

<script>
import moment from 'moment';

export default {
  name: 'input-timeinterval',
  props: {
    defaultDuration: {
      type: Number,
      default: 60 * 60,
    },
  },
  data: () => {
    return {
      mode: 'last_duration',
      duration: null,
      start: null,
      end: null,
    };
  },  
  mounted: function() {
    this.duration = this.defaultDuration;
  },
  computed: {
    daterange: {
      get() {
        if (this.mode == 'range' && this.start && this.end) {
          return [moment(this.start), moment(this.end)];
        } else {
          return [moment().subtract(this.duration, 'seconds'), moment()];
        }
      },
    },
    emptyDaterange() {
      return this.mode == 'range' && !(this.start && this.end);
    },
    invalidDaterange() {
      return this.mode == 'range' && moment(this.start) >= moment(this.end);
    },
  },
  methods: {
    showTimeline() {
      this.$emit('update-timeline', this.daterange);
    },
    changeDuration(e) {
      // This is only for last_duration, range mode changes daterange automatically
      this.duration = e.target.value;
    },
  },
};
</script>
