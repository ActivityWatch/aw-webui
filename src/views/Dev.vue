<template lang="pug">
div
  h3 Developer zone
  | Just some tools to aid in development and debugging.

  p
    | Nothing to see here right now...

  h4 Timespiral (WIP)
  TimespiralView
</template>

<script lang="ts">
import TimespiralView from '~/views/TimespiralView.vue';

export default {
  name: 'aw-dev',
  components: {
    TimespiralView: TimespiralView,
  },
};
</script>
