<template lang="pug">
div
  h3 {{ $t('experiments.developerZoneTitle') }}
  | {{ $t('experiments.developerZoneDescription') }}

  p
    | {{ $t('experiments.developerZoneEmpty') }}
</template>

<script lang="ts">
export default {
  name: 'aw-dev',
};
</script>
