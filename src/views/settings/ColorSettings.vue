<template lang="pug">
div.d-flex.justify-content-between
  div
    h5.mb-0 Use fallback colors
    small
      | Uses the old coloring style for some visualizations when uncategorized or no category color.
  div
    b-form-checkbox(v-model="useColorFallback", switch)
</template>

<script>
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
