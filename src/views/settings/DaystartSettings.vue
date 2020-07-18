<template lang="pug">
div.row
  div.col-sm-9
    h5.mb-0 Start of day
    small
      | The time at which days "start", since humans don't always go to bed before midnight. Set to 04:00 by default.
  div.col-sm-3
    input.form-control(type="time" :value="startOfDay" @change="setStartOfDay($event.target.value)")
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
