<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.language.title') }}
    div
      b-select.landingpage(v-if="_loaded" size="sm" :value="locale", @change="locale = $event")
        option(value="en") {{ $t('common.languageEn') }}
        option(value="uk") {{ $t('common.languageUk') }}
        option(value="de") {{ $t('common.languageDe') }}
        option(value="ru") {{ $t('common.languageRu') }}
      span(v-else)
        .aw-loading {{ $t('common.loading') }}
  small
    | {{ $t('settings.language.help') }}
</template>

<script lang="ts">
import { mapState } from 'pinia';
import { useSettingsStore } from '~/stores/settings';
import { isAppLocale, setAppLocale } from '~/i18n';

export default {
  name: 'LanguageSettings',
  computed: {
    ...mapState(useSettingsStore, ['_loaded']),
    locale: {
      get() {
        const { locale } = useSettingsStore();
        return isAppLocale(locale) ? locale : 'en';
      },
      set(value: string) {
        if (!isAppLocale(value)) {
          return;
        }
        useSettingsStore().update({ locale: value });
        setAppLocale(value);
      },
    },
  },
};
</script>
