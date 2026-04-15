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
    | You can use the #[router-link(:to="{ path: '/settings/category-builder' }") Category Builder] to quickly create categories from uncategorized activity.
    | You can also find and share categorization rule presets on #[a(href="https://forum.activitywatch.net/c/projects/category-rules") the forum].
    | For help on how to write categorization rules, see #[a(href="https://docs.activitywatch.net/en/latest/features/categorization.html") the documentation].

  // Category set switcher
  div.my-3.p-3(style="background: var(--bs-light, #f8f9fa); border-radius: 4px;")
    div.d-flex.align-items-center.flex-wrap(style="gap: 0.5rem;")
      span.font-weight-bold(style="white-space: nowrap") Category set:
      b-select(
        v-model="activeSetId"
        @change="onSetChange"
        style="max-width: 220px"
        size="sm"
      )
        b-select-option(
          v-for="set in categoryStore.category_sets"
          :key="set.id"
          :value="set.id"
        ) {{ set.id }}
      b-btn(
        @click="createSet"
        variant="outline-primary"
        size="sm"
      ) New set
      b-btn(
        v-if="categoryStore.category_sets.length > 1"
        @click="deleteActiveSet"
        variant="outline-danger"
        size="sm"
      ) Delete set
    div.mt-1(
      v-if="categoryStore.category_sets.length > 1"
      style="font-size: 0.85em; color: var(--bs-secondary, #6c757d);"
    )
      | {{ categoryStore.category_sets.length }} sets available — switch sets to use different rule profiles.

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
    div(v-if="editingId !== null")
      CategoryEditModal(:categoryId='editingId', @hidden="hideEditModal()")

  div.row
    div.col-sm-12
      b-btn(@click="addClass")
        icon.mr-2(name="plus")
        | Add category
      b-btn.float-right(@click="saveClasses", variant="success" :disabled="!classes_unsaved_changes")
        | Save
</template>
<script lang="ts">
import { mapState, mapGetters } from 'pinia';
import CategoryEditTree from '~/components/CategoryEditTree.vue';
import CategoryEditModal from '~/components/CategoryEditModal.vue';
import 'vue-awesome/icons/undo';

import { useCategoryStore } from '~/stores/categories';

import _ from 'lodash';
import { downloadFile } from '~/util/export';

const confirmationMessage = 'Your categories have unsaved changes, are you sure you want to leave?';

export default {
  name: 'CategorizationSettings',
  components: {
    CategoryEditTree,
    CategoryEditModal,
  },
  data: () => ({
    categoryStore: useCategoryStore(),
    editingId: null,
    activeSetId: 'default',
  }),
  computed: {
    ...mapState(useCategoryStore, ['classes_unsaved_changes']),
    ...mapGetters(useCategoryStore, ['classes_hierarchy']),
  },
  watch: {
    'categoryStore.active_set_ids': {
      handler(newIds: string[]) {
        if (newIds && newIds.length > 0) {
          this.activeSetId = newIds[0];
        }
      },
      immediate: true,
    },
  },
  mounted() {
    this.categoryStore.load();

    // Warn user about unsaved changes when closing/refreshing the browser tab.
    // Route navigation guard is handled by the parent Settings.vue component
    // using beforeRouteLeave (automatically cleaned up by Vue Router).
    window.addEventListener('beforeunload', this.beforeUnload);
  },
  beforeDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnload);
  },
  methods: {
    addClass: function () {
      this.categoryStore.addClass({
        name: ['New class'],
        rule: { type: 'regex', regex: 'FILL ME' },
      });

      // Find the category with the max ID, and open an editor for it
      const lastId = _.max(_.map(this.categoryStore.classes, 'id'));
      this.editingId = lastId;
    },
    saveClasses: async function () {
      await this.categoryStore.save();
    },
    resetClasses: async function () {
      await this.categoryStore.load();
    },
    restoreDefaultClasses: async function () {
      await this.categoryStore.restoreDefaultClasses();
    },
    hideEditModal: function () {
      this.editingId = null;
    },
    exportClasses: async function () {
      console.log('Exporting categories...');

      // Export the active set with its ID — suitable for re-importing as a named set
      const activeSetId = this.categoryStore.active_set_ids[0] || 'default';
      const activeSet = this.categoryStore.category_sets.find(s => s.id === activeSetId);
      const export_data = activeSet || { id: activeSetId, categories: this.categoryStore.classes };
      const text = JSON.stringify(export_data, null, 2);
      await downloadFile(`aw-category-export-${export_data.id}.json`, text, 'application/json');
    },
    importCategories: async function (elem) {
      console.log('Importing categories...');

      // Get file from upload
      const file = elem.target.files[0];
      if (file.type != 'application/json') {
        console.error('Only JSON files are possible to import');
        return;
      }

      // Read and parse import text to JSON
      const text = await file.text();
      const import_obj = JSON.parse(text);

      if (import_obj.categories && !import_obj.id) {
        // Legacy format: flat categories array — import into the active set
        this.categoryStore.import(import_obj.categories);
      } else if (import_obj.id && import_obj.categories) {
        // New CategorySet format — create or overwrite set with same ID
        let setId = import_obj.id;
        while (
          this.categoryStore.category_sets.find(
            s => s.id === setId && s.id !== (this.categoryStore.active_set_ids[0] || '')
          )
        ) {
          // Avoid duplicate IDs (except if overwriting the active set)
          setId = setId + '-imported';
        }
        const existing = this.categoryStore.category_sets.find(s => s.id === setId);
        if (existing) {
          existing.categories = import_obj.categories;
        } else {
          this.categoryStore.category_sets.push({ id: setId, categories: import_obj.categories });
        }
        this.categoryStore.switchToSet(setId);
        this.categoryStore.classes_unsaved_changes = true;
      } else {
        console.error('Unrecognized import format');
      }
    },
    createSet: function () {
      const name = prompt('Name for the new category set:');
      if (!name) return;
      if (this.categoryStore.category_sets.find(s => s.id === name)) {
        alert(`A set named "${name}" already exists.`);
        return;
      }
      // Create the new set and switch to it (switchToSet syncs current state first)
      this.categoryStore.createSet(name);
      this.categoryStore.switchToSet(name);
    },
    deleteActiveSet: function () {
      const id = this.categoryStore.active_set_ids[0];
      if (!id) return;
      if (!confirm(`Delete category set "${id}"? This cannot be undone.`)) return;
      this.categoryStore.deleteSet(id);
      this.categoryStore.save();
    },
    onSetChange: function (setId: string) {
      if (this.classes_unsaved_changes) {
        if (!confirm('You have unsaved changes. Switch sets anyway? (Changes will be discarded)')) {
          // Revert the select back to current active
          this.activeSetId = this.categoryStore.active_set_ids[0] || 'default';
          return;
        }
      }
      this.categoryStore.switchToSet(setId);
    },
    beforeUnload: function (e) {
      if (this.classes_unsaved_changes) {
        e = e || window.event;
        e.preventDefault();
        e.returnValue = confirmationMessage;
        return confirmationMessage;
      }
    },
  },
};
</script>
