<template lang="pug">
div
  h4.mb-3 Developer settings
    span.mx-2
    span(v-if="!showSettings")
      b-btn(@click="showSettings = true;" size="sm" variant="outline-dark")
        | Show
    span(v-else)
      b-btn(@click="showSettings = false;" size="sm" variant="outline-dark")
        | Hide
  div(v-if="showSettings")
    p These settings are meant for developers who (hopefully) know what they are doing.
    div.d-flex.justify-content-between
      div
        h5.mb-0 Show yearly time range
      div
        b-form-checkbox(v-model="showYearly" switch)
    small
      | Querying an entire year is a very heavy operation, and is likely to lead to timeouts. However, the query might be fast enough if you're running aw-server-rust.
</template>

<script>
export default {
  data() {
    return {
      showSettings: false,
      showYearly: false,
    };
  },
  watch: {
    showYearly: {
      handler() {
        this.saveData();
      },
    },
  },
  created() {
    this.retrieveData();
  },
  methods: {
    retrieveData() {
      if (localStorage.showYearly && JSON.parse(localStorage.showYearly)) {
        try {
          this.showYearly = JSON.parse(localStorage.showYearly);
        } catch (e) {
          console.error('could not parse showYearly, deleting');
          localStorage.removeItem('showYearly');
        }
      } else {
        console.info('showYearly not found in localStorage');
      }
    },
    saveData() {
      const parsed = JSON.stringify(this.showYearly);
      localStorage.showYearly = parsed;
    },
  },
};
</script>
