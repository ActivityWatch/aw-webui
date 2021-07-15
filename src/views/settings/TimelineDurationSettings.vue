<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mb-2.mb-sm-0 {{ $t('duration') }}
    div
      b-select(size="sm" :value="durationDefaultValue", @change="setDurationDefault($event.target.value)")
          option(:value="15*60") 15min
          option(:value="30*60") 30min
          option(:value="60*60") 1h
          option(:value="2*60*60") 2h
          option(:value="4*60*60") 4h
          option(:value="6*60*60") 6h
          option(:value="12*60*60") 12h
          option(:value="24*60*60") 24h
  small
    | {{ $t('durationHelp') }}
</template>
<script>
export default {
  name: 'TimelineDurationSettings',
  data: () => {
    return {
      durationDefaultValue: localStorage.durationDefault || 60 * 60,
    };
  },
  mounted() {
    this.startOfDay = localStorage.startOfDay;
  },
  methods: {
    setDurationDefault: function (duration) {
      localStorage.durationDefault = duration;
      console.log('Set default timeline duration to ' + duration);
    },
  },
};
</script>
