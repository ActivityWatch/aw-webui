<template lang="pug">
div
  h5.d-inline-block
    div Categorization
  div.float-right
    b-btn.ml-1(@click="restoreDefaultClasses", variant="outline-warning" size="sm")
      icon(name="undo")
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
    div(v-for="_class in classes_hierarchy")
      CategoryEditTree(:_class="_class")

  div.row
    div.col-sm-12
      b-btn(@click="addClass")
        icon.mr-2(name="plus")
        | Add category
      b-btn.float-right(@click="saveClasses", variant="success" :disabled="!classes_unsaved_changes")
        | Save
</template>
<script>
import { mapState, mapGetters } from 'vuex';
import CategoryEditTree from '~/components/CategoryEditTree.vue';
import 'vue-awesome/icons/undo';

export default {
  name: 'CategorizationSettings',
  components: {
    CategoryEditTree,
  },
  computed: {
    ...mapGetters('categories', ['classes_hierarchy']),
    ...mapState('categories', ['classes_unsaved_changes']),
  },
  mounted() {
    this.$store.dispatch('categories/load');
  },
  methods: {
    addClass: function () {
      this.$store.commit('categories/addClass', {
        name: ['New class'],
        rule: { type: 'regex', regex: 'FILL ME' },
      });
    },
    saveClasses: async function () {
      await this.$store.dispatch('categories/save');
    },
    resetClasses: async function () {
      await this.$store.dispatch('categories/load');
    },
    restoreDefaultClasses: async function () {
      await this.$store.commit('categories/restoreDefaultClasses');
    },
  },
};
</script>
