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
      const data = this.data[this.watcher];
      const urlParams = new URLSearchParams({
        view: this.view,
      });
      if (data) {
        urlParams.set('data', JSON.stringify(data));
      }
      return (
        document.location.origin + '/watcher/pages/' + this.watcher + '/?' + urlParams.toString()
      );
    },
  },
};
</script>
