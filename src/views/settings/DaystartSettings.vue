<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('dayStart') }}
    div
      b-input(type="time" size="sm" :value="startOfDay" @change="setStartOfDay($event.target.value)")
  small
    | {{ $t('startHelp1') }}
    | {{ $t('startHelp2') }}
</template>
<script>
export default {
  name: 'DaystartSettings',
  data: () => {
    return {
      startOfDay: '',
    };
  },
  mounted() {
    this.startOfDay = localStorage.startOfDay;
  },
  methods: {
    setStartOfDay: function (time_minutes) {
      localStorage.startOfDay = time_minutes;
      console.log('Set start of day to ' + time_minutes);
    },
  },
};
</script>
