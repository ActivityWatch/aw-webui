<template lang="pug">
div
  h5.d-inline-block
    div Categorization
  div.float-right
    b-btn.ml-1(@click="restoreDefaultClasses", variant="outline-warning" size="sm")
      icon(name="undo")
      | Restore defaults
    label.btn.btn-sm.ml-1.btn-outline-primary(style="margin: 0")
      | Import
      input(type="file" @change="importCategories" hidden)
    b-btn.ml-1(@click="exportClasses", variant="outline-primary" size="sm")
      | Export
  p
    | Rules for categorizing events. An event can only have one category. If several categories match, the deepest one will be chosen.
  p
    | For help on how to write categorization rules, see #[a(href="https://docs.activitywatch.net/en/latest/features/categorization.html") the documentation].

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
    exportClasses: function () {
      console.log('Exporting categories...');

      const export_data = {
        categories: JSON.parse(localStorage.classes),
      };
      const text = JSON.stringify(export_data);
      const filename = 'aw-category-export.json';

      // Initiate downloading a file by creating a hidden button and clicking it
      const element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
      element.setAttribute('download', filename);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
    },
    importCategories: async function (elem) {
      console.log('Importing categories...');

      // Get file from upload
      const file = elem.originalTarget.files[0];
      if (file.type != 'application/json') {
        console.error('Only JSON files are possible to import');
        return;
      }

      // Read and parse import text to JSON
      const text = await file.text();
      const import_obj = JSON.parse(text);

      // Set import to categories as unsaved changes
      this.$store.commit('categories/import', import_obj.categories);
    },
  },
};
</script>
