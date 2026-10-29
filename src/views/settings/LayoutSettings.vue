<template lang="pug">
form(@submit.prevent="save")
  h5 {{ $t('settings.layout.title') }}
  p.small.text-muted {{ $t('settings.layout.help') }}
  fieldset(:disabled="saving || !loaded")
    .form-group.mb-3
      label(for="layout-text-size") {{ $t('settings.layout.textSize') }}
      input#layout-text-size.form-control.layout-number(type="number" min="80" max="150" step="1" v-model="draftTextSize" aria-describedby="layout-text-help")
      small#layout-text-help.form-text.text-muted {{ $t('settings.layout.textHelp') }}
    .form-group.mb-3
      .custom-control.custom-checkbox.mb-2
        input#layout-automatic-width.custom-control-input(type="checkbox" v-model="automaticWidth")
        label.custom-control-label(for="layout-automatic-width") {{ $t('settings.layout.automaticWidth') }}
      label(for="layout-content-width") {{ $t('settings.layout.contentWidth') }}
      input#layout-content-width.form-control.layout-number(type="number" min="600" max="2400" step="1" v-model="draftContentWidth" :disabled="automaticWidth" aria-describedby="layout-width-help")
      small#layout-width-help.form-text.text-muted {{ $t('settings.layout.widthHelp') }}
    .d-flex.flex-wrap
      button.btn.btn-primary.mr-2.mb-2(type="submit") {{ $t(saving ? 'settings.layout.saving' : 'settings.layout.save') }}
      button.btn.btn-outline-secondary.mb-2(type="button" data-testid="layout-reset" @click="reset") {{ $t('settings.layout.reset') }}
  p.text-danger.mt-2.mb-0(v-if="error" role="alert") {{ error }}
  p.text-success.mt-2.mb-0(v-else-if="saved" role="status") {{ $t('settings.layout.saved') }}
</template>

<script lang="ts">
import { mapState } from 'pinia';
import {
  useSettingsStore,
  DEFAULT_TEXT_SIZE,
  DEFAULT_CONTENT_WIDTH,
  isTextSize,
  isContentWidth,
} from '~/stores/settings';

export default {
  name: 'LayoutSettings',
  data() {
    const store = useSettingsStore();
    return {
      draftTextSize: store.textSize as number | string,
      draftContentWidth: (store.contentWidth || 1200) as number | string,
      automaticWidth: store.contentWidth === 0,
      saving: false,
      saved: false,
      error: '',
      retryKeys: [] as string[],
    };
  },
  computed: {
    ...mapState(useSettingsStore, ['loaded', 'textSize', 'contentWidth']),
  },
  watch: {
    textSize(value: number, previous: number) {
      if (
        !this.saving &&
        Number(this.draftTextSize) === previous &&
        !this.retryKeys.includes('textSize')
      ) {
        this.draftTextSize = value;
      }
    },
    contentWidth(value: number, previous: number) {
      const draft = this.automaticWidth ? 0 : Number(this.draftContentWidth);
      if (!this.saving && draft === previous && !this.retryKeys.includes('contentWidth')) {
        this.automaticWidth = value === 0;
        this.draftContentWidth = value || 1200;
      }
    },
    draftTextSize() {
      this.saved = false;
    },
    draftContentWidth() {
      this.saved = false;
    },
    automaticWidth() {
      this.saved = false;
    },
  },
  methods: {
    async save() {
      if (this.saving) return;
      const textSize = Number(this.draftTextSize);
      const contentWidth = this.automaticWidth ? 0 : Number(this.draftContentWidth);
      this.saved = false;
      this.error = '';
      if (
        !isTextSize(textSize) ||
        !isContentWidth(contentWidth) ||
        (!this.automaticWidth && contentWidth === 0)
      ) {
        this.error = this.$t('settings.layout.invalid');
        return;
      }
      const values: { textSize?: number; contentWidth?: number } = {};
      // Failed per-key writes may have reached the server despite local rollback.
      // Retry those keys even when the user chooses the rolled-back value.
      if (textSize !== this.textSize || this.retryKeys.includes('textSize')) {
        values.textSize = textSize;
      }
      if (contentWidth !== this.contentWidth || this.retryKeys.includes('contentWidth')) {
        values.contentWidth = contentWidth;
      }
      await this.persist(values);
    },
    async reset() {
      if (this.saving) return;
      this.draftTextSize = DEFAULT_TEXT_SIZE;
      this.automaticWidth = DEFAULT_CONTENT_WIDTH === 0;
      this.draftContentWidth = DEFAULT_CONTENT_WIDTH || 1200;
      await this.persist({ textSize: DEFAULT_TEXT_SIZE, contentWidth: DEFAULT_CONTENT_WIDTH });
    },
    async persist(values: { textSize?: number; contentWidth?: number }) {
      this.saving = true;
      this.saved = false;
      this.error = '';
      try {
        await useSettingsStore().update(values);
        this.retryKeys = [];
        const store = useSettingsStore();
        this.draftTextSize = store.textSize;
        this.automaticWidth = store.contentWidth === 0;
        this.draftContentWidth = store.contentWidth || 1200;
        // Report the values actually reloaded, not stale drafts from a competing save.
        await this.$nextTick();
        if (Object.keys(values).some(key => store[key] !== values[key])) {
          this.error = this.$t('settings.layout.changedElsewhere');
        } else {
          this.saved = true;
        }
      } catch (error) {
        this.retryKeys = Array.from(new Set([...this.retryKeys, ...Object.keys(values)]));
        this.error = this.$t('settings.layout.saveFailed');
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<style scoped>
.layout-number {
  max-width: 12rem;
}
</style>
