<template lang="pug">
div
  p.mb-2
    | {{ $t('categories.description') }}
  p
    | {{ $t('categories.builderIntroBefore') }}
    span {{ $t('categories.categoryBuilder') }}
    | {{ $t('categories.builderIntroAfter') }}
    a(href="https://forum.activitywatch.net/c/projects/category-rules") {{ $t('categories.forum') }}
    | {{ $t('categories.builderIntroAfterForum') }}
    a(href="https://docs.activitywatch.net/en/latest/features/categorization.html") {{ $t('categories.documentation') }}
    | {{ $t('categories.builderIntroAfterDocs') }}

  // Category set switcher. bg-light + .rounded so dark.css's .bg-light
  // override flips the background in dark mode instead of leaving an
  // inline white block on a dark canvas.
  div.my-3.p-3.bg-light.rounded
    div.d-flex.align-items-center.flex-wrap(style="gap: 0.5rem;")
      span.font-weight-bold(style="white-space: nowrap") {{ $t('categories.categorySet') }}
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
      ) {{ $t('categories.newSet') }}
      b-btn(
        v-if="categoryStore.category_sets.length > 1"
        @click="deleteActiveSet"
        variant="outline-danger"
        size="sm"
      ) {{ $t('categories.deleteSet') }}
    div.mt-1.small.text-muted(v-if="categoryStore.category_sets.length > 1")
      | {{ $t('categories.setsAvailable', { count: categoryStore.category_sets.length }) }}

  div.d-flex.align-items-center.flex-wrap.mt-4
    h5.mb-0 {{ $t('categories.categories') }}
    div.ml-auto
      b-btn.ml-1(@click="restoreDefaultClasses", variant="outline-warning" size="sm")
        icon(name="undo")
        | {{ $t('categories.restoreDefaults') }}
      label.btn.btn-sm.ml-1.btn-outline-primary(style="margin: 0")
        | {{ $t('categories.import') }}
        input(type="file" @change="importCategories" hidden)
      b-btn.ml-1(@click="exportClasses", variant="outline-primary" size="sm")
        | {{ $t('categories.export') }}

  div.my-3
    b-alert(variant="warning" :show="classes_unsaved_changes")
      | {{ $t('categories.unsavedChanges') }}
      div.float-right(style="margin-top: -0.15em; margin-right: -0.6em")
        b-btn.ml-2(@click="saveClasses", variant="success" size="sm")
          | {{ $t('common.save') }}
        b-btn.ml-2(@click="resetClasses", variant="warning" size="sm")
          | {{ $t('categories.discard') }}
    div(v-for="_class in classes_hierarchy")
      CategoryEditTree(:_class="_class")
    div(v-if="editingId !== null")
      CategoryEditModal(:categoryId='editingId', @hidden="hideEditModal()")

  div.row
    div.col-sm-12
      b-btn(@click="addClass")
        icon.mr-2(name="plus")
        | {{ $t('categories.addCategory') }}
      b-btn.float-right(@click="saveClasses", variant="success" :disabled="!classes_unsaved_changes")
        | {{ $t('common.save') }}

  // Category Builder sits at the end of the categories list (above the
  // ActivePatternSettings panel below the group). Collapsed by default
  // so the words query doesn't fire for users who only came to edit
  // rules; once opened it mounts lazily.
  div.mt-4(ref="builderSection")
    div.d-flex.align-items-center.flex-wrap
      h5.mb-0 {{ $t('categories.categoryBuilder') }}
      small.text-muted.ml-2 {{ $t('categories.builderSubtitle') }}
      b-btn.ml-auto(
        variant="outline-primary"
        size="sm"
        @click="builderOpen = !builderOpen"
        :aria-expanded="builderOpen ? 'true' : 'false'"
        aria-controls="category-builder-collapse"
      )
        icon.mr-1(:name="builderOpen ? 'angle-double-up' : 'angle-double-down'")
        | {{ builderOpen ? $t('categories.hideBuilder') : $t('categories.openBuilder') }}
    b-collapse#category-builder-collapse(v-model="builderOpen")
      div.mt-3(v-if="builderMounted")
        CategoryBuilder(embedded)
</template>
<script lang="ts">
import { mapState, mapGetters } from 'pinia';
import CategoryEditTree from '~/components/CategoryEditTree.vue';
import CategoryEditModal from '~/components/CategoryEditModal.vue';
import 'vue-awesome/icons/undo';
import 'vue-awesome/icons/angle-double-down';
import 'vue-awesome/icons/angle-double-up';

import { useCategoryStore } from '~/stores/categories';

import _ from 'lodash';
import { downloadFile } from '~/util/export';

export default {
  name: 'CategorizationSettings',
  components: {
    CategoryEditTree,
    CategoryEditModal,
    // Lazy-load the builder so visiting Categorization without opening
    // the builder doesn't drag in its query/word-list code.
    CategoryBuilder: () => import('~/views/settings/CategoryBuilder.vue'),
  },
  data: () => ({
    categoryStore: useCategoryStore(),
    editingId: null,
    activeSetId: 'default',
    builderOpen: false,
    builderMounted: false,
  }),
  computed: {
    ...mapState(useCategoryStore, ['classes_unsaved_changes']),
    ...mapGetters(useCategoryStore, ['classes_hierarchy']),
  },
  watch: {
    builderOpen(v: boolean) {
      if (v) this.builderMounted = true;
    },
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

    // Deep-link from UncategorizedNotification ("Category Builder" link) lands
    // on /settings/categorization?builder=open — open the builder and scroll
    // it into view so the user can act immediately.
    if (this.$route.query.builder === 'open') {
      this.builderOpen = true;
      this.$nextTick(() => {
        const el = this.$refs.builderSection as HTMLElement | undefined;
        if (el && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }
  },
  beforeDestroy() {
    window.removeEventListener('beforeunload', this.beforeUnload);
  },
  methods: {
    confirmationMessage: function () {
      return this.$t('categories.confirmLeave');
    },
    addClass: function () {
      this.categoryStore.addClass({
        name: [this.$t('categories.newClass')],
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

      // Export the active set with its ID — suitable for re-importing as a named set.
      // Use classes_clean (current in-memory state) so unsaved edits are included.
      const activeSetId = this.categoryStore.active_set_ids[0] || 'default';
      const export_data = { id: activeSetId, categories: this.categoryStore.classes_clean };
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
          // If importing into the active set, don't call switchToSet — it would call
          // syncToPrimarySet first and overwrite the just-imported categories with
          // stale in-memory classes. Use discardChanges to recompute from the updated set.
          const isActiveSet = setId === (this.categoryStore.active_set_ids[0] || '');
          if (isActiveSet) {
            this.categoryStore.discardChanges();
          } else {
            this.categoryStore.switchToSet(setId);
          }
        } else {
          this.categoryStore.category_sets.push({ id: setId, categories: import_obj.categories });
          this.categoryStore.switchToSet(setId);
        }
        this.categoryStore.classes_unsaved_changes = true;
      } else {
        console.error('Unrecognized import format');
      }
    },
    createSet: function () {
      const name = prompt(this.$t('categories.newSetPrompt'));
      if (!name) return;
      if (this.categoryStore.category_sets.find(s => s.id === name)) {
        alert(this.$t('categories.setAlreadyExists', { name }));
        return;
      }
      // Create the new set and switch to it (switchToSet syncs current state first)
      this.categoryStore.createSet(name);
      this.categoryStore.switchToSet(name);
    },
    deleteActiveSet: function () {
      const id = this.categoryStore.active_set_ids[0];
      if (!id) return;
      if (!confirm(this.$t('categories.deleteSetConfirm', { id }))) return;
      this.categoryStore.deleteSet(id);
      this.categoryStore.save();
    },
    onSetChange: function (setId: string) {
      if (this.classes_unsaved_changes) {
        if (!confirm(this.$t('categories.switchSetConfirm'))) {
          // Revert the select back to current active
          this.activeSetId = this.categoryStore.active_set_ids[0] || 'default';
          return;
        }
        // User confirmed discard: reset in-memory edits before switching so that
        // switchToSet() → syncToPrimarySet() writes back the original (clean) state,
        // not the unsaved edits the user just chose to discard.
        this.categoryStore.discardChanges();
      }
      this.categoryStore.switchToSet(setId);
    },
    beforeUnload: function (e) {
      if (this.classes_unsaved_changes) {
        e = e || window.event;
        e.preventDefault();
        e.returnValue = this.confirmationMessage();
        return this.confirmationMessage();
      }
    },
  },
};
</script>
