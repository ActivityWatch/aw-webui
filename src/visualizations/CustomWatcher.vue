<template lang="pug">
div
  div.aw-custom-watcher-container
    span hello there!
    pre {{ fields }}
</template>

<style scoped lang="scss" />

<script>
export default {
  name: 'aw-custom-watcher',
  props: {
    fields: Array,
  },
  data: function () {
    return {};
  },
  watch: {
    fields: function () {
      this.update();
    },
  },
  methods: {
    update: function () {
      const el = this.$el.children[0];
      if (this.fields !== null) {
        console.log(this.fields);
      } else {
        console.log('LOADING EL: ', el);
      }
    },
  },
};
</script>
