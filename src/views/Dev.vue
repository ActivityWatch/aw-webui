<template lang="pug">
div
  h3 Developer zone
  | {{ $t('ui.dev.intro') }}

  p
  | {{ $t('ui.dev.empty') }}
</template>

<script lang="ts">
export default {
  name: 'aw-dev',
};
</script>
