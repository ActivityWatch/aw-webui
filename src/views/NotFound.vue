<template lang="pug">
div
  h3 {{ $t('experiments.notFoundTitle') }}
  p.mb-0
    | {{ $t('experiments.notFoundHint') }}
</template>

<script lang="ts">
export default {
  name: 'NotFound',
};
</script>
