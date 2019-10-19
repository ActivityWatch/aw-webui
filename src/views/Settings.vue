<template lang="pug">
div
  h3 Settings

  b-alert(variant="warning", show) #[b Note:] These settings are only saved in your browser and will not remain if you switch browser. We are working on getting this fixed.

  hr

  div.row
    div.col-sm-9
      h5.mb-0 Start of day
      small
        | The time at which days "start", since humans don't always go to bed before midnight. Set to 04:00 by default.
    div.col-sm-3
      input.form-control(type="time" :value="startOfDay" @change="setStartOfDay($event.target.value)")

  hr

  h5.d-inline-block
    div Categorization
  div.float-right
    b-btn.ml-1(@click="restoreDefaults", variant="warning" size="sm")
      | Restore defaults
  div
    | An event can have many tags, but only one category. If several categories match, the deepest one will be chosen.

  div.my-4
    b-alert(variant="warning" :show="classes_unsaved_changes")
      | You have unsaved changes!
      b-btn.float-right.ml-1(@click="resetClasses", variant="warning" size="sm")
        | Reset
    div(v-for="cls in classes_hierarchy")
      CategoryEditTree(:cls="cls")

  div.row
    div.col-sm-12
      b-btn(@click="addClass") Add category
      b-btn.float-right(@click="saveClasses", variant="success" :disabled="!classes_unsaved_changes")
        | Save
</template>

<script>
import CategoryEditTree from './CategoryEditTree.vue';
import { restoreDefaultClasses } from '~/util/classes';
import { mapState, mapGetters } from 'vuex';

export default {
  name: "Settings",
  components: {
    CategoryEditTree,
  },
  data: () => {
    return {
      startOfDay: '',
    }
  },
  computed: {
    ...mapGetters('settings', ['classes_hierarchy']),
    ...mapState('settings', ['classes_unsaved_changes'])
  },

  mounted() {
    this.startOfDay = localStorage.startOfDay;
    this.$store.dispatch('settings/load');
  },

  methods: {
    setStartOfDay: function(time_minutes) {
      localStorage.startOfDay = time_minutes;
    },
    addClass: function() {
      this.$store.commit('settings/addClass', {name: ["New class"], rule: {type: "regex", pattern: "FILL ME"}});
    },
    saveClasses: async function() {
      await this.$store.dispatch('settings/save');
    },
    resetClasses: async function() {
      await this.$store.dispatch('settings/load');
    },
    restoreDefaults: async function() {
      restoreDefaultClasses();
      await this.$store.dispatch('settings/load');
    },
  }
}
</script>
