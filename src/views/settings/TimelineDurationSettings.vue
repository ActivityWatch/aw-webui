<template lang="pug">
div
  div.d-sm-flex.justify-content-between
    div
      h5.mb-2.mb-sm-0 Duration default value
    div
      b-select(size="sm" :value="durationDefault", @change="durationDefault = $event")
          option(:value="15*60") 15min
          option(:value="30*60") 30min
          option(:value="60*60") 1h
          option(:value="2*60*60") 2h
          option(:value="4*60*60") 4h
          option(:value="6*60*60") 6h
          option(:value="12*60*60") 12h
          option(:value="24*60*60") 24h
  small
    | The default duration used for 'show last' in the timeline view.
</template>
<script>
import { useSettingsStore } from '~/stores/settings';

export default {
  name: 'TimelineDurationSettings',
  data() {
    return {
      settingsStore: useSettingsStore(),
    };
  },
  computed: {
    durationDefault: {
      get() {
        return this.settingsStore.durationDefault;
      },
      set(value) {
        console.log('Set default timeline duration to ' + value);
        this.settingsStore.update({ durationDefault: value });
      },
    },
  },
};
</script>
