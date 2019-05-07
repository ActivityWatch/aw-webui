
<template lang="pug">
div
  h3 Settings

  hr

  div.row
    div.col-sm-9
      div
        b Start of day
      small
        | Sets the time where the start/end of a day is in the daily activity view. &nbsp;
        div.d-inline.d-md-block
          | Set to 02:00 by default but can be set later for the night-owls.
    div.col-sm-3
      input.form-control(type="time" :value="startOfDay" @change="setStartOfDay($event.target.value)")
  br
</template>

<style scoped lang="scss">
</style>

<script>
export default {
  name: "Settings",

  data: () => {
    return {
      startOfDay: '',
    }
  },

  mounted() {
    this.startOfDay = localStorage.startOfDay;
  },

  methods: {
    setStartOfDay: function(time_minutes) {
      localStorage.startOfDay = time_minutes;
    }
  }
}
</script>
