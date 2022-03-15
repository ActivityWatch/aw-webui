<template lang="pug">
div.d-flex.justify-content-between
  div
    h5.mb-0 Use fallback colors
    small
      | Uses the old coloring style for some visualizations when uncategorized or no category color.
  div
    b-form-checkbox(v-model="useColorFallback", switch)
</template>

<script>
export default {
  name: 'ColorSettings',
  computed: {
    useColorFallback: {
      get: function () {
        return this.$store.state.settings.useColorFallback;
      },
      set: function (val) {
        this.$store.dispatch('settings/update', { useColorFallback: val });
      },
    },
  },
};
</script>
