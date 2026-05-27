<template lang="pug">
div
  h3 {{ $t('notFound.title') }}
  p.mb-0
    | {{ $t('notFound.message') }}
</template>

<script lang="ts">
export default {
  name: 'NotFound',
};
</script>
