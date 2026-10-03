<template lang="pug">
div
  h3 Woops, this page was not found!
  p.mb-0
    | {{ $t('notFound.hint') }}
</template>

<script lang="ts">
export default {
  name: 'NotFound',
};
</script>
