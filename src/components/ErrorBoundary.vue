<template lang="pug">
div
  b-alert(variant="danger", v-for="error in errors", :key='error.msg', :show='!error.dismissed', dismissible, @dismissed="error.dismissed = false")
    | {{ error.msg }}
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
    //console.error(err, vm, info);
    this.errors.push({
      msg: (err.name && err.message) ? (err.name + ": " + err.message) : err,
      dismissed: false,
    });
  },
}
</script>
