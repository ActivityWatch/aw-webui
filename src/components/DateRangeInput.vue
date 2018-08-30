<template lang="pug">

div
  div
    span Show last:
    span
      select(:value="duration", @change="valueChanged")
        option(:value="15*60") 15min
        option(:value="60*60") 1h
        option(:value="6*60*60") 6h
        option(:value="24*60*60") 24h
</template>

<style scoped lang="scss">
</style>

<script>
import moment from 'moment';

export default {
  name: "DateRangeInput",
  data: () => {
    return {
      now: moment(),
      duration: 60 * 60,
      customRange: null,
    }
  },
  computed: {
    value: {
      get() {
        if(this.customRange) {
          return this.customRange;
        } else {
          return [
            moment(this.now).subtract(this.duration, "seconds"),
            moment(this.now)
          ];
        }
      },
      set(newValue) {
        console.log(newValue);
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
