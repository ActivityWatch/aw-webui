<template lang="pug">
div(v-if="!PRODUCTION")
  b-alert(v-if="note", variant="warning" show)
    | This will not appear in the production build. #[span(v-if="reason") ({{ reason }})]
  slot
</template>

<script>
export default {
  props: {
    note: {
      type: Boolean,
      default: true,
    },
    reason: {
      type: String,
      default: null,
    },
  },
};
</script>
