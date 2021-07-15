<template lang="pug">
div(v-if="show", style="border: 1px solid #aaa; border-radius: 5px")
  b-alert(v-if="note", variant="warning" show)
    span.float-left {{ $t('devOnly') }} #[span(v-if="reason") ({{ reason }})]
    b-btn.float-right.hide-devonly(@click="() => { hide = true }", variant="outline-secondary", size="sm")
      | {{ $t('hide') }}
    | .
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
  data: () => {
    return { hide: false };
  },
  computed: {
    show() {
      return !PRODUCTION && !this.hide;
    },
  },
};
</script>
