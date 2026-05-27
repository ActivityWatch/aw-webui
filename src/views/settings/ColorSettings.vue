<template lang="pug">
div.d-flex.justify-content-between
  div
    h5.mb-0 {{ $t('settings.colorFallback') }}
    small {{ $t('settings.colorFallbackDesc') }}
  div
    b-form-checkbox(v-model="useColorFallback", switch)
</template>

<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'ColorSettings',
  computed: {
    useColorFallback: {
      get: function () {
        const settingsStore = useSettingsStore();
        return settingsStore.useColorFallback;
      },
      set: function (val) {
        const settingsStore = useSettingsStore();
        settingsStore.update({ useColorFallback: val });
      },
    },
  },
};
</script>
