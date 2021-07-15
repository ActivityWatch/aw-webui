<template lang="pug">
div
  h3 {{ $t('notFound') }}
  p.mb-0
    | {{ $t('notFoundHelp') }}
</template>

<script>
export default {
  name: 'NotFound',
};
</script>
