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
    watcher: String,
    view: String,
  },
  computed: {
    src: function () {
      const urlParams = new URLSearchParams({
        view: this.view,
        // TODO: Pass the start / end date selected in the activity watch GUI
        start: null,
        end: null,
      });
      return (
        document.location.origin + '/watcher/pages/' + this.watcher + '/?' + urlParams.toString()
      );
    },
  },
};
</script>
