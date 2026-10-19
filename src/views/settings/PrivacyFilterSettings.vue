<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.privacyFilters.title') }}
    div
      b-btn.ml-1(@click="resetEditor" variant="outline-warning" size="sm" :disabled="!hasUnsavedChanges || isSaving")
        | {{ $t('settings.privacyFilters.discard') }}
      b-btn.ml-1(@click="savePrivacyFilters" variant="success" size="sm" :disabled="!canSave")
        | {{ $t('settings.privacyFilters.save') }}
  p.mt-2.mb-2
    | {{ $t('settings.privacyFilters.help') }}
    | {{ $t('settings.privacyFilters.settingHelp') }} #[code privacy_filters] {{ $t('settings.privacyFilters.serverHelp') }}
  small.text-muted
    | {{ $t('settings.privacyFilters.disabledHelp') }}

  b-alert.mt-3(:show="saveError !== ''" variant="danger")
    | {{ saveError }}

  b-alert.mt-3(:show="validationErrors.length > 0" variant="danger")
    div(v-for="error in validationErrors" :key="error")
      | {{ error }}

  b-alert.mt-3(:show="hasUnsavedChanges && validationErrors.length === 0" variant="warning")
    | {{ $t('settings.privacyFilters.unsavedChanges') }}

  b-form-textarea.mt-3(
    v-model="editorText"
    rows="14"
    max-rows="24"
    :state="editorState"
    style="font-family: monospace"
  )

  small.d-block.text-muted.mt-2
    | {{ $t('settings.privacyFilters.ruleHelp') }} #[code enabled], #[code pattern], #[code action], {{ $t('settings.privacyFilters.and') }} #[code field].
    | {{ $t('settings.privacyFilters.redactHelp') }} #[code replacement].
    | {{ $t('settings.privacyFilters.regexHelp') }}

  small.d-block.text-muted.mt-3 {{ $t('settings.privacyFilters.example') }}
  pre.mt-3.mb-0.small(style="white-space: pre-wrap") {{ exampleText }}
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';
import { getClient } from '~/util/awclient';
import {
  PrivacyFilterRule,
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
        // While saving, the store holds the submitted rules optimistically;
        // only the save's outcome may move the saved baseline.
        if (this.isSaving) {
          return;
        }
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

      const rules = this.validationResult.rules || [];
      const confirmed = JSON.parse(JSON.stringify(this.settingsStore.privacy_filters));
      const submittedText = this.editorText;
      this.isSaving = true;
      this.saveError = '';
      try {
        await this.settingsStore.ensureLoaded();
        // Hold the submitted rules in the store during the request: a
        // concurrent save of another setting writes every key that differs
        // from the server, and must not write the old rules back.
        this.settingsStore.$patch(state => {
          state.privacy_filters = rules;
        });
        await getClient().req.post('/0/settings/privacy_filters', rules, {
          headers: { 'Content-Type': 'application/json' },
        });
        this.savedText = formatPrivacyFilters(rules);
        if (this.editorText === submittedText) {
          // Keep edits made while the save was pending.
          this.editorText = this.savedText;
        }
      } catch (error) {
        // The server decides what was persisted (the write may have landed
        // before the error). Fall back to the last confirmed rules if it
        // cannot be asked. The draft stays in the editor for a retry.
        let persisted = confirmed;
        try {
          const serverSettings = (await getClient().get_settings()) as {
            privacy_filters?: PrivacyFilterRule[];
          };
          if (serverSettings.privacy_filters !== undefined) {
            persisted = serverSettings.privacy_filters;
          }
        } catch {
          // Keep the last confirmed rules.
        }
        this.settingsStore.$patch(state => {
          state.privacy_filters = persisted;
        });
        this.savedText = formatPrivacyFilters(persisted);
        this.saveError = error instanceof Error ? error.message : String(error);
      } finally {
        this.isSaving = false;
      }
    },
  },
};
</script>
