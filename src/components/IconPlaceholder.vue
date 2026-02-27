<template>
  <!-- Placeholder for vue-awesome icon (Vue 2 only). Replace with Vue 3 icon library. -->
  <span class="icon-placeholder" :data-icon="name"></span>
</template>

<script>
// vue-awesome is Vue 2 only. This is a placeholder component used during the Vue 3 migration.
// TODO: Replace with a Vue 3-compatible icon library (e.g. @fortawesome/vue-fontawesome or unplugin-icons)
export default {
  name: 'IconPlaceholder',
  props: {
    name: {
      type: String,
      default: '',
    },
    scale: {
      type: [Number, String],
      default: 1,
    },
  },
};
</script>
