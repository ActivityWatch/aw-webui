<template lang="pug">
div
  b-alert(variant="danger", v-for="error in errors", :show='!error.dismissed', dismissible, @dismissed="error.dismissed = false")
    | {{ error.msg }}
  slot
</template>

<script>
export default {
  name: 'ErrorBoundary',
  data() {
    return { errors: [] };
  },
  errorCaptured (err, vm, info) {
    console.error(err, vm, info);
    this.errors.push({
      msg: err,
      dismissed: false,
    });
  },
}
</script>
