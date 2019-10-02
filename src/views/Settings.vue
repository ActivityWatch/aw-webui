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

  h6 Categories
  div(v-for="cls in $store.getters['settings/classes_hierarchy']")
    CategoryEditTree(:cls="cls")
  div.row
    div.col-sm-12
      b-btn(@click="addClass") Add new class
      b-btn.float-right(@click="saveClasses", variant="success")
        | Save tagging rules
</template>

<script>
import CategoryEditTree from './CategoryEditTree.vue';

export default {
  name: "Settings",

  data: () => {
    return {
      startOfDay: '',
    }
  },
  components: {
    CategoryEditTree,
  },

  mounted() {
    console.log(this.$store);
    this.startOfDay = localStorage.startOfDay;
    this.$store.dispatch('settings/load');
  },

  methods: {
    setStartOfDay: function(time_minutes) {
      localStorage.startOfDay = time_minutes;
    },
    addClass: function() {
      this.$store.commit('settings/addClass', {name: "New class", rule: {type: "regex", pattern: "FILL ME"}});
    },
    saveClasses: function() {
      this.$store.dispatch('settings/save');
    },
    resetClasses: function() {
      this.$store.dispatch('settings/load');
    },
  }
}
</script>
