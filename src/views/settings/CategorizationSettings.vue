<template lang="pug">
div
  p.mb-2
    | {{ $t('settings.categorization.rulesHelp') }}
  p
    | {{ $t('settings.categorization.forumIntro') }}
    |  #[a(href="https://forum.activitywatch.net/c/projects/category-rules") {{ $t('settings.categorization.forum') }}].
    | {{ $t('settings.categorization.docsIntro') }}
    |  #[a(href="https://docs.activitywatch.net/en/latest/features/categorization.html") {{ $t('settings.categorization.documentation') }}].

  div.my-3.p-3.bg-light.rounded
    div.d-flex.align-items-center.flex-wrap(style="gap: 0.5rem;")
      span.font-weight-bold(style="white-space: nowrap") {{ $t('settings.categorization.categorySet') }}
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
      ) {{ $t('settings.categorization.newSet') }}
      b-btn(
        v-if="categoryStore.category_sets.length > 1"
        @click="deleteActiveSet"
        variant="outline-danger"
        size="sm"
      ) {{ $t('settings.categorization.deleteSet') }}
    div.mt-1.small.text-muted(v-if="categoryStore.category_sets.length > 1")
      | {{ $t('settings.categorization.setsAvailable', { count: categoryStore.category_sets.length }) }}

  div.d-flex.align-items-center.flex-wrap.mt-4
    h5.mb-0 {{ $t('settings.categorization.categories') }}
    div.ml-auto
      b-btn.ml-1(@click="restoreDefaultClasses", variant="outline-warning" size="sm")
        icon(name="undo")
        | {{ $t('settings.categorization.restoreDefaults') }}
      label.btn.btn-sm.ml-1.btn-outline-primary(style="margin: 0")
        | {{ $t('common.import') }}
        input(type="file" @change="importCategories" hidden)
      b-btn.ml-1(@click="exportClasses", variant="outline-primary" size="sm")
        | {{ $t('common.export') }}

  div.my-3
    b-alert(variant="warning" :show="classes_unsaved_changes")
      | {{ $t('settings.categorization.unsavedChanges') }}
      div.float-right(style="margin-top: -0.15em; margin-right: -0.6em")
        b-btn.ml-2(@click="saveClasses", variant="success" size="sm")
          | {{ $t('common.save') }}
        b-btn.ml-2(@click="resetClasses", variant="warning" size="sm")
          | {{ $t('settings.categorization.discard') }}
    div(v-for="_class in classes_hierarchy")
      CategoryEditTree(:_class="_class")
    div(v-if="editingId !== null")
      CategoryEditModal(:categoryId='editingId', @hidden="hideEditModal()")

  div.row
    div.col-sm-12
      b-btn(@click="addClass")
        icon.mr-2(name="plus")
        | {{ $t('settings.categorization.addCategory') }}
      b-btn.float-right(@click="saveClasses", variant="success" :disabled="!classes_unsaved_changes")
        | {{ $t('common.save') }}

  div.mt-4(ref="builderSection")
    div.d-flex.align-items-center.flex-wrap
      h5.mb-0 {{ $t('settings.categorization.builderTitle') }}
      small.text-muted.ml-2 {{ $t('settings.categorization.builderSubtitle') }}
      b-btn.ml-auto(
        variant="outline-primary"
        size="sm"
        @click="builderOpen = !builderOpen"
        :aria-expanded="builderOpen ? 'true' : 'false'"
        aria-controls="category-builder-collapse"
      )
        icon.mr-1(:name="builderOpen ? 'angle-double-up' : 'angle-double-down'")
        | {{ builderOpen ? $t('settings.categorization.hideBuilder') : $t('settings.categorization.openBuilder') }}
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
    window.addEventListener('beforeunload', this.beforeUnload);

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
    addClass: function () {
      this.categoryStore.addClass({
        name: ['New class'],
        rule: { type: 'regex', regex: 'FILL ME' },
      });

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
      const activeSetId = this.categoryStore.active_set_ids[0] || 'default';
      const export_data = { id: activeSetId, categories: this.categoryStore.classes_clean };
      const text = JSON.stringify(export_data, null, 2);
      await downloadFile(`aw-category-export-${export_data.id}.json`, text, 'application/json');
    },
    importCategories: async function (elem) {
      const file = elem.target.files[0];
      if (file.type != 'application/json') {
        console.error('Only JSON files are possible to import');
        return;
      }

      const text = await file.text();
      const import_obj = JSON.parse(text);

      if (import_obj.categories && !import_obj.id) {
        this.categoryStore.import(import_obj.categories);
      } else if (import_obj.id && import_obj.categories) {
        let setId = import_obj.id;
        while (
          this.categoryStore.category_sets.find(
            s => s.id === setId && s.id !== (this.categoryStore.active_set_ids[0] || '')
          )
        ) {
          setId = setId + '-imported';
        }
        const existing = this.categoryStore.category_sets.find(s => s.id === setId);
        if (existing) {
          existing.categories = import_obj.categories;
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
      const name = prompt('Name for the new category set:');
      if (!name) return;
      if (this.categoryStore.category_sets.find(s => s.id === name)) {
        alert(`A set named "${name}" already exists.`);
        return;
      }
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
          this.activeSetId = this.categoryStore.active_set_ids[0] || 'default';
          return;
        }
        this.categoryStore.discardChanges();
      }
      this.categoryStore.switchToSet(setId);
    },
    beforeUnload: function (e) {
      if (this.classes_unsaved_changes) {
        const msg = this.$t('settings.unsavedCategoriesLeave');
        e = e || window.event;
        e.preventDefault();
        e.returnValue = msg;
        return msg;
      }
    },
  },
};
</script>
