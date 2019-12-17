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
    b-btn.ml-1(@click="restoreDefaultClasses", variant="outline-warning" size="sm")
      | Restore defaults
  div
    | Rules for categorizing events. An event can only have one category. If several categories match, the deepest one will be chosen.

  div.my-4
    b-alert(variant="warning" :show="classes_unsaved_changes")
      | You have unsaved changes!
      div.float-right(style="margin-top: -0.15em; margin-right: -0.6em")
        b-btn.ml-2(@click="saveClasses", variant="success" size="sm")
          | Save
        b-btn.ml-2(@click="resetClasses", variant="warning" size="sm")
          | Discard
    div(v-for="cls in classes_hierarchy")
      CategoryEditTree(:cls="cls")

  div.row
    div.col-sm-12
      b-btn(@click="addClass")
        icon.mr-2(name="plus")
        | Add category
      b-btn.float-right(@click="saveClasses", variant="success" :disabled="!classes_unsaved_changes")
        | Save
</template>

<script>
import CategoryEditTree from '~/components/CategoryEditTree.vue';
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
      this.$store.commit('settings/addClass', {name: ["New class"], productivity:-1, rule: {type: "regex", regex: "FILL ME"}});
    },
    saveClasses: async function() {
      await this.$store.dispatch('settings/save');
    },
    resetClasses: async function() {
      await this.$store.dispatch('settings/load');
    },
    restoreDefaultClasses: async function() {
      await this.$store.commit('settings/restoreDefaultClasses');
    },
  }
}
</script>
