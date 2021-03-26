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
  data: () => {
    return {
      useColorFallback: localStorage.useColorFallback || true,
    };
  },
  methods: {
    set: function (useColorFallback) {
      localStorage.useColorFallback = useColorFallback;
      console.log('Set useColorFallback to ' + useColorFallback);
    },
  },
};
</script>
