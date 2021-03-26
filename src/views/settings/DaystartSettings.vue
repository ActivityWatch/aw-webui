<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 Start of day
    div
      b-input(type="time" size="sm" :value="startOfDay" @change="setStartOfDay($event.target.value)")
  small
    | The time at which days "start", since humans don't always go to bed before midnight.
    | Set to 04:00 by default.
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
