<template lang="pug">
div.d-flex.justify-content-between
  div
    h5.mb-0 {{ $t('settings.color.title') }}
    small.text-muted
      | {{ $t('settings.color.help') }}
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
        return useSettingsStore().useColorFallback;
      },
      set: function (val) {
        useSettingsStore().update({ useColorFallback: val });
      },
    },
  },
};
</script>
