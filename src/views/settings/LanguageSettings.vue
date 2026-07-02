<template lang="pug">
div.language-settings
  b-form-group(:label="$t('language.label')")
    b-form-select(v-model="selectedLocale" :options="localeOptions")
</template>

<script lang="ts">
import { setLocale, SUPPORTED_LOCALES } from '~/i18n';

export default {
  name: 'LanguageSettings',
  computed: {
    selectedLocale: {
      get() {
        return this.$i18n.locale;
      },
      set(locale: string) {
        setLocale(locale);
      },
    },
    localeOptions() {
      return SUPPORTED_LOCALES.map(l => ({ value: l.code, text: l.label }));
    },
  },
};
</script>
