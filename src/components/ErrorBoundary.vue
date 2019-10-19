<template lang="pug">
div
  b-alert(variant="danger", v-for="error in errors", :key='error.time', :show='!error.dismissed', dismissible, @dismissed="error.dismissed = false")
    | {{ error.msg }}.
    | See dev console (F12) and/or server logs for more info.
  slot
</template>

<script>
// Based on: https://medium.com/@dillonchanis/handling-errors-in-vue-with-error-boundaries-91f6ead0093b
export default {
  name: 'ErrorBoundary',
  data() {
    return { errors: [] };
  },
  errorCaptured (err, vm, info) {
    //console.error("Error captured!");
    //console.error(err, vm, info);
    const msg = (err.name && err.message) ? (err.name + ": " + err.message) : err;
    this.errors.push({
      msg: msg,
      time: new Date().toISOString(),
      dismissed: false,
    });
  },
}
</script>
