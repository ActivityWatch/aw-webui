<template lang="pug">
div(v-if="show", style="border: 1px solid #aaa; border-radius: 5px")
  b-alert(v-if="note", variant="warning" :model-value="true")
    span.float-start This will not appear in the production build #[span(v-if="reason") ({{ reason }})]
    b-button.float-end.hide-devonly(@click="() => { hide = true }", variant="outline-secondary", size="sm")
      | Hide
    | .
  slot
</template>

<script lang="ts">
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
