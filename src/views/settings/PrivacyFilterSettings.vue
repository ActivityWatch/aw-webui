<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 Privacy filters
    div
      b-btn.ml-1(@click="resetEditor" variant="outline-warning" size="sm" :disabled="!hasUnsavedChanges || isSaving")
        | Discard
      b-btn.ml-1(@click="savePrivacyFilters" variant="success" size="sm" :disabled="!canSave")
        | Save
  p.mt-2.mb-2
    | Regex-based rules that drop or redact sensitive event data before it is stored.
    | Rules are saved to the server setting #[code privacy_filters] and used by aw-server-rust.
  small.text-muted
    | Leave the editor empty or save <code>[]</code> to disable the feature.

  b-alert.mt-3(:show="saveError !== ''" variant="danger")
    | {{ saveError }}

  b-alert.mt-3(:show="validationErrors.length > 0" variant="danger")
    div(v-for="error in validationErrors" :key="error")
      | {{ error }}

  b-alert.mt-3(:show="hasUnsavedChanges && validationErrors.length === 0" variant="warning")
    | You have unsaved changes.

  b-form-textarea.mt-3(
    v-model="editorText"
    rows="14"
    max-rows="24"
    :state="editorState"
    style="font-family: monospace"
  )

  small.d-block.text-muted.mt-2
    | Each rule needs #[code enabled], #[code pattern], #[code action], and #[code field].
    | Redact rules also need #[code replacement].
    | Regex syntax is validated by the server when you save.

  small.d-block.text-muted.mt-3 Example
  pre.mt-3.mb-0.small(style="white-space: pre-wrap") {{ exampleText }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import {
  DEFAULT_PRIVACY_FILTERS,
  formatPrivacyFilters,
  validatePrivacyFiltersInput,
} from '~/util/privacyFilters';

export default {
  name: 'PrivacyFilterSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
      editorText: '',
      savedText: '',
      saveError: '',
      isSaving: false,
    };
  },
  computed: {
    validationResult() {
      return validatePrivacyFiltersInput(this.editorText);
    },
    validationErrors() {
      return this.validationResult.errors;
    },
    canSave() {
      return this.hasUnsavedChanges && this.validationErrors.length === 0 && !this.isSaving;
    },
    hasUnsavedChanges() {
      return this.editorText !== this.savedText;
    },
    editorState() {
      if (!this.hasUnsavedChanges) {
        return null;
      }
      return this.validationErrors.length === 0;
    },
    exampleText() {
      return formatPrivacyFilters(DEFAULT_PRIVACY_FILTERS);
    },
  },
  watch: {
    'settingsStore.privacy_filters': {
      deep: true,
      handler() {
        this.syncFromStore(false);
      },
    },
  },
  mounted() {
    this.syncFromStore(true);
  },
  methods: {
    syncFromStore(overwriteEditor: boolean) {
      const serialized = formatPrivacyFilters(this.settingsStore.privacy_filters);
      if (overwriteEditor || this.editorText === this.savedText) {
        this.editorText = serialized;
      }
      this.savedText = serialized;
    },
    resetEditor() {
      this.saveError = '';
      this.syncFromStore(true);
    },
    async savePrivacyFilters() {
      if (!this.canSave) {
        return;
      }

      this.isSaving = true;
      this.saveError = '';
      try {
        await this.settingsStore.update({
          privacy_filters: this.validationResult.rules || [],
        });
        this.syncFromStore(true);
      } catch (error) {
        this.saveError = error instanceof Error ? error.message : String(error);
      } finally {
        this.isSaving = false;
      }
    },
  },
};
</script>
