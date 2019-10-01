
<template lang="pug">
div
  h3 Settings

  b-alert(variant="warning", show) #[b Note:] These settings are only saved in your browser and will not remain if you switch browser. We are working on getting this fixed.

  hr

  div.row
    div.col-sm-9
      h5.mb-0 Start of day
      small
        | Sets the time where the start/end of a day is in the daily activity view. Set to 04:00 by default.
    div.col-sm-3
      input.form-control(type="time" :value="startOfDay" @change="setStartOfDay($event.target.value)")

  hr

  h5
    div Tagging & Categorization
    b-btn.float-right(@click="resetClasses", variant="warning" size="sm")
      | Reset
  div
    small An event can have many tags, but only one category. If several categories match, the deepest one will be chosen.

  div.row(v-for="cls in classes")
    div.col-sm-6
      b-input-group.mb-2(prepend="Name")
        b-form-input(v-model="cls.name")
    div.col-sm-6
      b-input-group.mb-2(prepend="Regex")
        b-form-input(v-model="cls.re")
  div.row
    div.col-sm-12
      b-btn(@click="addClass") Add new class
      b-btn.float-right(@click="saveClasses", variant="success")
        | Save tagging rules
</template>

<script>
import { saveClasses, loadClasses, defaultClasses } from '~/util/classes.js';

export default {
  name: "Settings",

  data: () => {
    return {
      startOfDay: '',
      classes: [],
    }
  },

  mounted() {
    this.startOfDay = localStorage.startOfDay;
    this.classes = loadClasses();
  },

  methods: {
    setStartOfDay: function(time_minutes) {
      localStorage.startOfDay = time_minutes;
    },
    addClass: function() {
      this.classes.push({name: "New class", re: "FILL ME"})
    },
    saveClasses: function() {
      saveClasses(this.classes);
    },
    resetClasses: function() {
      this.classes = defaultClasses;
    },
  }
}
</script>
