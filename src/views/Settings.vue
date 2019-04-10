
<template lang="pug">
div
  h3 Settings

  table.table
    tbody
      tr
        td Start of day
        td
          input(type="time" :value="startOfDay" @change="setStartOfDay($event.target.value)")
        td
          | Sets the time where the start/end of a day is in the daily activity view.
          br
          | Set to 02:00 by default but can be set later for the night-owls.
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
