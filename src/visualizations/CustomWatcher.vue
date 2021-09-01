<template lang="pug">
div
  div.aw-custom-watcher-container
    iframe(:src='src', frameborder='0')
</template>

<style scoped lang="scss" />

<script>
export default {
  name: 'aw-custom-watcher',
  props: {
    data: Array,
    watcher: String,
    view: String,
  },
  computed: {
    src: function () {
      return (
        document.location.origin +
        '/watcher/pages/' +
        this.watcher +
        '/?' +
        new URLSearchParams({
          data: JSON.stringify(this.data[this.watcher]),
          view: this.view,
        }).toString()
      );
    },
  },
};
</script>
