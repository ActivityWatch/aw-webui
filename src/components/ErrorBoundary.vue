<template lang="pug">
div
	b-alert(variant="danger", v-for="error in errors", :key='error.time', :show='!error.dismissed', dismissible, @dismissed="error.dismissed = false")
		| {{ error.msg }}
	slot
</template>

<script>
// Based on: https://medium.com/@dillonchanis/handling-errors-in-vue-with-error-boundaries-91f6ead0093b
export default {
  name: 'ErrorBoundary',
  data() {
    return {
      errors: [],
    };
  },
  errorCaptured(err, _vm, _info) {
    // console.error("Error captured!");
    // console.error(err, vm, info);

    // fallback
    let msg = err;
    // use server error response if available; err.isAxiosError doesn't help much here…
    if (err.response && err.response.data && err.response.data.message) {
      msg = err.response.data.message;
    } else if (err.name && err.message) {
      msg = `${err.name}: ${err.message}.
				See dev console (F12) and/or server logs for more info.`;
    }

    this.errors.push({
      msg: msg,
      time: new Date().toISOString(),
      dismissed: false,
    });
  },
};
</script>
