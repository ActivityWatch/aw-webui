<template lang="pug">
div
  div.d-flex.justify-content-between
    div
      h5.mb-0 New release notification
    div
      b-form-checkbox(v-model="isEnabled" switch)
  small
    | We will send you a notification if there is a new release available for download, this check will happen at most once per day.
</template>

<script>
export default {
  computed: {
    isEnabled: {
      get() {
        return this.$store.state.settings.newReleaseCheckData.isEnabled;
      },
      set(value) {
        const data = this.$store.state.settings.newReleaseCheckData;
        this.$store.dispatch('settings/update', {
          newReleaseCheckData: { ...data, isEnabled: value },
        });
      },
    },
  },
};
</script>
