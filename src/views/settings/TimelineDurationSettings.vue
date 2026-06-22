<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mt-1.mb-2.mb-sm-0 {{ $t('settings.timelineDuration.title') }}
    div
      b-select(size="sm" v-model="durationDefault")
          option(:value="15*60") 15m
          option(:value="30*60") 30m
          option(:value="60*60") 1h
          option(:value="2*60*60") 2h
          option(:value="4*60*60") 4h
          option(:value="6*60*60") 6h
          option(:value="12*60*60") 12h
          option(:value="24*60*60") 24h
  small.text-muted
    | {{ $t('settings.timelineDuration.help') }}
</template>
<script lang="ts">
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'TimelineDurationSettings',
  computed: {
    durationDefault: {
      get: function () {
        return useSettingsStore().durationDefault;
      },
      set: function (value) {
        useSettingsStore().update({ durationDefault: value });
      },
    },
  },
};
</script>
