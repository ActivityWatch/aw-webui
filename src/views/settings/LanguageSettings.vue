<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.languageTitle') }}
    div
      b-select(v-if="_loaded" size="sm" :value="language", @change="language = $event")
        option(v-for="locale in supportedLocales" :key="locale.code" :value="locale.code")
          | {{ locale.label }}
      span(v-else)
        .aw-loading {{ $t('common.loading') }}
  small
    | {{ $t('settings.languageDescription') }}
</template>

<script lang="ts">
import { mapState } from 'pinia';
import { SUPPORTED_LOCALES, setLocale, type SupportedLocale } from '~/i18n';
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'LanguageSettings',
  data() {
    return {
      supportedLocales: SUPPORTED_LOCALES,
    };
  },
  computed: {
    ...mapState(useSettingsStore, ['_loaded']),
    language: {
      get(): SupportedLocale {
        return useSettingsStore().language;
      },
      set(value: SupportedLocale) {
        setLocale(value);
        useSettingsStore().update({ language: value });
      },
    },
  },
};
</script>
