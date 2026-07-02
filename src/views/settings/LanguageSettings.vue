<template lang="pug">
div.language-settings
  b-form-group(:label="$t('language.label')")
    b-form-select(v-model="selectedLocale" :options="localeOptions" @change="onLocaleChange")
</template>

<script lang="ts">
import { i18n, setLocale, SUPPORTED_LOCALES } from '~/i18n';

export default {
  name: 'LanguageSettings',
  data() {
    return {
      selectedLocale: i18n.locale,
    };
  },
  computed: {
    localeOptions() {
      return SUPPORTED_LOCALES.map(l => ({ value: l.code, text: l.label }));
    },
  },
  methods: {
    onLocaleChange(locale: string) {
      setLocale(locale);
    },
  },
};
</script>
